#!/usr/bin/env python3
"""
Génération de quittances de loyer à partir des fiches locataires du vault.

Moteur PDF : fpdf2 (pur Python, pas de dépendance GTK/Cairo).

Usage:
    python generer_quittance.py --locataire "Kenan Beguigneau" --mois 2026-05
    python generer_quittance.py --locataire "Kenan Beguigneau" --mois 2026-01 2026-02 2026-03
    python generer_quittance.py --locataire "Kenan Beguigneau" --du 2026-01 --au 2026-05
    python generer_quittance.py --tous --mois 2026-05
    python generer_quittance.py --locataire "Kenan" --mois 2026-05 --dry-run

Sortie:
    G:\\Mon Drive\\Obsidian\\08. Outils\\Quittances\\_generees\\<Nom>\\Quittance-<Nom>-YYYY-MM.pdf

Pré-requis:
    pip install -r requirements.txt
"""

from __future__ import annotations
import argparse
import calendar
import datetime as dt
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import yaml
from num2words import num2words
from fpdf import FPDF
from fpdf.enums import XPos, YPos

# ---------------------------------------------------------------------------
# Configuration (chemins) — ajuster ici si la structure du vault change
# ---------------------------------------------------------------------------

VAULT_ROOT = Path(os.environ.get("VAULT_ROOT", r"G:\Mon Drive\Obsidian"))
LOCATAIRES_DIR = VAULT_ROOT / "07. Contacts" / "05. Locataires" / "01. Actuels"
QUITTANCES_DIR = VAULT_ROOT / "08. Outils" / "Quittances"
BIENS_FILE = "biens.yml"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", str(VAULT_ROOT / "08. Outils" / "Quittances" / "_generees")))

MOIS_FR = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Locataire:
    nom_fichier: str
    nom_affiche: str
    civilite: str | None        # "Monsieur", "Madame" (frontmatter `civilite`)
    email: str | None
    adresse_bien: str
    montant_loyer: float
    montant_charges: float
    date_entree_bail: dt.date | None
    date_fin_bail: dt.date | None
    moyen_paiement: str = "Virement bancaire"

    @property
    def total(self) -> float:
        return self.montant_loyer + self.montant_charges

    @property
    def nom_avec_civilite(self) -> str:
        if self.civilite:
            return f"{self.civilite} {self.nom_affiche}"
        return self.nom_affiche

    @property
    def initiales(self) -> str:
        """Initiales pour le numéro de quittance : K. Beguigneau → KBE"""
        parts = re.split(r"\s+", self.nom_fichier.strip())
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][:2]).upper()
        return self.nom_fichier[:3].upper()


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

def lire_fiche_locataire(path: Path) -> Locataire | None:
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    fm = yaml.safe_load(m.group(1)) or {}

    def _parse_date(v):
        if v is None or v == "":
            return None
        if isinstance(v, dt.date):
            return v
        try:
            return dt.date.fromisoformat(str(v))
        except ValueError:
            return None

    loyer = fm.get("montant_loyer")
    charges = fm.get("montant_charges") or 0
    adresse = fm.get("adresse_bien") or ""
    if loyer in (None, "") or not adresse:
        return None

    return Locataire(
        nom_fichier=path.stem,
        nom_affiche=fm.get("nom_officiel") or path.stem,
        civilite=fm.get("civilite") or None,
        email=fm.get("email") or None,
        adresse_bien=adresse,
        montant_loyer=float(loyer),
        montant_charges=float(charges),
        date_entree_bail=_parse_date(fm.get("date_entree_bail")),
        date_fin_bail=_parse_date(fm.get("date_fin_bail")),
    )


def lister_locataires_actuels() -> list[Locataire]:
    if not LOCATAIRES_DIR.exists():
        raise SystemExit(f"Dossier locataires introuvable : {LOCATAIRES_DIR}")
    locataires = []
    for f in LOCATAIRES_DIR.glob("*.md"):
        if f.name.startswith("_"):
            continue
        loc = lire_fiche_locataire(f)
        if loc:
            locataires.append(loc)
    return locataires


def trouver_locataire(query: str) -> Locataire | None:
    def norm(s: str) -> str:
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
        return re.sub(r"\s+", " ", s).strip()
    qn = norm(query)
    locataires = lister_locataires_actuels()
    for loc in locataires:
        if norm(loc.nom_fichier) == qn:
            return loc
    matches = [loc for loc in locataires if qn in norm(loc.nom_fichier)]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        noms = ", ".join(m.nom_fichier for m in matches)
        raise SystemExit(f"Plusieurs locataires correspondent à « {query} » : {noms}. Préciser.")
    return None


# ---------------------------------------------------------------------------
# Bien lookup
# ---------------------------------------------------------------------------

def charger_biens() -> dict:
    with open(QUITTANCES_DIR / BIENS_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def resoudre_bien(loc: Locataire, biens_cfg: dict) -> dict:
    adresse_lc = loc.adresse_bien.lower()
    for bien in biens_cfg["biens"]:
        for frag in bien["match_adresse"]:
            if frag.lower() in adresse_lc:
                ligne1 = bien["ligne1"]
                cp_ville = bien["cp_ville"]
                if "ligne2" in bien:
                    ligne2 = bien["ligne2"]
                elif "ligne2_template" in bien:
                    m = re.search(r"(studio\s+\d+)", loc.adresse_bien, re.IGNORECASE)
                    studio = m.group(1).capitalize() if m else "Studio"
                    ligne2 = bien["ligne2_template"].format(studio=studio)
                elif "ligne2_par_cote" in bien:
                    ligne2 = bien.get("ligne2_defaut", "Studio")
                    for cle, val in bien["ligne2_par_cote"].items():
                        if cle in adresse_lc:
                            ligne2 = val
                            break
                else:
                    ligne2 = ""
                return {"ligne1": ligne1, "ligne2": ligne2, "cp_ville": cp_ville}
    raise SystemExit(
        f"Bien introuvable pour le locataire {loc.nom_fichier} (adresse_bien='{loc.adresse_bien}'). "
        f"Compléter biens.yml ou la fiche locataire."
    )


# ---------------------------------------------------------------------------
# Période parsing
# ---------------------------------------------------------------------------

def parse_mois(s: str) -> tuple[int, int]:
    s = s.strip()
    m = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r"^(\d{1,2})/(\d{4})$", s)
    if m:
        return int(m.group(2)), int(m.group(1))
    parts = s.lower().split()
    if len(parts) == 2:
        try:
            idx = [x.lower() for x in MOIS_FR].index(parts[0])
            return int(parts[1]), idx
        except (ValueError, IndexError):
            pass
    raise ValueError(f"Format de mois non reconnu : {s}")


def plage_mois(du: str, au: str) -> list[tuple[int, int]]:
    y1, m1 = parse_mois(du)
    y2, m2 = parse_mois(au)
    out = []
    y, m = y1, m1
    while (y, m) <= (y2, m2):
        out.append((y, m))
        m += 1
        if m == 13:
            m = 1
            y += 1
    return out


# ---------------------------------------------------------------------------
# Variables quittance
# ---------------------------------------------------------------------------

def montant_en_lettres(montant: float) -> str:
    n = int(round(montant))
    return num2words(n, lang="fr") + " euros"


def variables_quittance(
    loc: Locataire,
    annee: int,
    mois: int,
    biens_cfg: dict,
    date_emission: dt.date | None = None,
    date_paiement: dt.date | None = None,
    moyen_paiement: str | None = None,
) -> dict:
    bien = resoudre_bien(loc, biens_cfg)
    debut = dt.date(annee, mois, 1)
    fin = dt.date(annee, mois, calendar.monthrange(annee, mois)[1])
    if date_emission is None:
        date_emission = dt.date(annee + (mois // 12), (mois % 12) + 1, 3)
    if date_paiement is None:
        date_paiement = dt.date(annee, mois, 2)

    # Résolution du chemin signature (relatif au dossier Quittances)
    sig_path = biens_cfg["bailleur"].get("signature_image") or ""
    if sig_path:
        sig_abs = Path(sig_path)
        if not sig_abs.is_absolute():
            sig_abs = QUITTANCES_DIR / sig_path
        signature_path = str(sig_abs) if sig_abs.exists() else None
    else:
        signature_path = None

    return {
        "bailleur_nom": biens_cfg["bailleur"]["nom"],
        "bailleur_telephone": biens_cfg["bailleur"]["telephone"],
        "bailleur_adresse": biens_cfg["bailleur"]["adresse"],
        "bailleur_cp_ville": biens_cfg["bailleur"]["cp_ville"],
        "signature_path": signature_path,
        "signature_largeur": biens_cfg["bailleur"].get("signature_largeur_mm", 40),
        "locataire_nom": loc.nom_avec_civilite,
        "bien_adresse_ligne1": bien["ligne1"],
        "bien_adresse_ligne2": bien["ligne2"],
        "bien_cp_ville": bien["cp_ville"],
        "periode_mois_annee": f"{MOIS_FR[mois]} {annee}",
        "periode_debut": debut.strftime("%d/%m/%Y"),
        "periode_fin": fin.strftime("%d/%m/%Y"),
        "loyer": int(loc.montant_loyer) if loc.montant_loyer.is_integer() else loc.montant_loyer,
        "charges": int(loc.montant_charges) if loc.montant_charges.is_integer() else loc.montant_charges,
        "total": int(loc.total) if loc.total.is_integer() else loc.total,
        "total_lettres": montant_en_lettres(loc.total),
        "date_paiement": date_paiement.strftime("%d/%m/%Y"),
        "moyen_paiement": moyen_paiement or loc.moyen_paiement,
        "lieu_emission": "Nanterre",
        "date_emission": date_emission.strftime("%d/%m/%Y"),
        "numero_quittance": f"QL-{annee}-{mois:02d}-{loc.initiales}",
    }


# ---------------------------------------------------------------------------
# Rendu PDF (fpdf2, pur Python)
# ---------------------------------------------------------------------------

FONT_CANDIDATES = [
    # Windows
    (r"C:\Windows\Fonts\arial.ttf",   r"C:\Windows\Fonts\arialbd.ttf"),
    (r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\calibrib.ttf"),
    # macOS
    ("/Library/Fonts/Arial.ttf",      "/Library/Fonts/Arial Bold.ttf"),
    ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/HelveticaNeue.ttc"),
    # Linux
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
     "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
]

def _trouver_font():
    for regular, bold in FONT_CANDIDATES:
        if Path(regular).exists() and Path(bold).exists():
            return regular, bold
    raise SystemExit(
        "Aucune police TTF Unicode trouvée. Installer une police standard (Arial/DejaVuSans) "
        "ou ajouter le chemin dans FONT_CANDIDATES dans generer_quittance.py."
    )


class QuittancePDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(left=22, top=20, right=22)
        self.set_auto_page_break(auto=True, margin=20)
        reg, bold = _trouver_font()
        self.add_font("Body", "", reg)
        self.add_font("Body", "B", bold)


# Helpers concis pour remplacer les anciens ln=True/False/2
NEXT_LINE = dict(new_x=XPos.LMARGIN, new_y=YPos.NEXT)
SAME_LINE = dict(new_x=XPos.RIGHT,   new_y=YPos.TOP)


def render_pdf(v: dict, output_path: Path) -> None:
    pdf = QuittancePDF()
    pdf.add_page()

    # --- Numéro de quittance (petit, en haut à droite) ---
    pdf.set_font("Body", "", 8)
    pdf.set_text_color(110, 110, 110)
    pdf.set_xy(150, 18)
    pdf.cell(40, 4, f"N° {v['numero_quittance']}", align="R")
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(22, 20)

    # --- Titre ---
    pdf.set_font("Body", "B", 22)
    pdf.cell(0, 12, "QUITTANCE DE LOYER", **NEXT_LINE)
    pdf.ln(4)

    # --- Mois ---
    pdf.set_font("Body", "", 11)
    pdf.cell(60, 6, "Quittance de loyer du mois de : ", **SAME_LINE)
    pdf.set_font("Body", "B", 11)
    pdf.cell(0, 6, v["periode_mois_annee"], **NEXT_LINE)
    pdf.ln(10)

    # --- Deux colonnes : bailleur / adresse ---
    col_y = pdf.get_y()
    col_w = 80

    def col_bloc(x, titre, lignes):
        pdf.set_xy(x, col_y)
        pdf.set_font("Body", "B", 11)
        pdf.cell(col_w, 6, titre, new_x=XPos.LEFT, new_y=YPos.NEXT)
        pdf.set_font("Body", "", 11)
        for ligne in lignes:
            pdf.set_x(x)
            pdf.cell(col_w, 5.5, ligne, new_x=XPos.LEFT, new_y=YPos.NEXT)

    col_bloc(22, "Coordonnées du bailleur", [
        v["bailleur_nom"],
        v["bailleur_telephone"],
        v["bailleur_adresse"],
        v["bailleur_cp_ville"],
    ])
    col_bloc(110, "Adresse de location", [
        v["bien_adresse_ligne1"],
        v["bien_adresse_ligne2"],
        v["bien_cp_ville"],
    ])

    pdf.set_y(col_y + 30)
    pdf.ln(6)

    # --- Texte juridique ---
    pdf.set_font("Body", "", 11)
    texte = (
        f"Je, soussigné {v['bailleur_nom']}, propriétaire du logement désigné ci-dessus, "
        f"déclare avoir reçu de {v['locataire_nom']}, la somme de "
        f"{v['total_lettres']} ({v['total']} €), au titre du paiement du loyer et des charges "
        f"pour la période de location du {v['periode_debut']} au {v['periode_fin']} "
        f"et lui en donne quittance, sous réserve de tous mes droits."
    )
    pdf.multi_cell(0, 5.5, texte, align="J")
    pdf.ln(6)

    # --- Détail du règlement ---
    pdf.set_font("Body", "B", 11)
    pdf.cell(0, 6, "Détail du règlement", **NEXT_LINE)
    pdf.ln(2)

    pdf.set_font("Body", "", 11)
    table_w = 166
    line_h = 7
    # ligne 1 : Loyer
    pdf.cell(table_w - 30, line_h, "Loyer", border="B", **SAME_LINE)
    pdf.cell(30, line_h, f"{v['loyer']} €", border="B", align="R", **NEXT_LINE)
    # ligne 2 : Charges
    pdf.cell(table_w - 30, line_h, "Provision pour charges", border="B", **SAME_LINE)
    pdf.cell(30, line_h, f"{v['charges']} €", border="B", align="R", **NEXT_LINE)
    # ligne 3 : Total (gras + bordure)
    pdf.set_font("Body", "B", 11)
    pdf.cell(table_w - 30, line_h, "Total", border="B", **SAME_LINE)
    pdf.cell(30, line_h, f"{v['total']} €", border="B", align="R", **NEXT_LINE)
    pdf.ln(6)

    # --- Date et moyen de paiement ---
    pdf.set_font("Body", "B", 11)
    pdf.cell(45, 5.5, "Date du paiement :", **SAME_LINE)
    pdf.set_font("Body", "", 11)
    pdf.cell(0, 5.5, v["date_paiement"], **NEXT_LINE)

    pdf.set_font("Body", "B", 11)
    pdf.cell(45, 5.5, "Moyen de paiement :", **SAME_LINE)
    pdf.set_font("Body", "", 11)
    pdf.cell(0, 5.5, v["moyen_paiement"], **NEXT_LINE)
    pdf.ln(12)

    # --- Lieu / date / signature ---
    pdf.set_font("Body", "", 11)
    pdf.cell(0, 5.5, f"Fait à {v['lieu_emission']}, le {v['date_emission']}", **NEXT_LINE)
    pdf.ln(4)
    pdf.set_font("Body", "B", 11)
    pdf.cell(0, 5.5, "Signature", **NEXT_LINE)

    # Image signature si disponible
    sig = v.get("signature_path")
    if sig and Path(sig).exists():
        sig_y = pdf.get_y() + 1
        try:
            pdf.image(sig, x=22, y=sig_y, w=v["signature_largeur"])
            pdf.set_y(sig_y + v["signature_largeur"] * 0.45)  # estimation hauteur
        except Exception as e:
            print(f"  ! Erreur insertion signature : {e}", file=sys.stderr)
            pdf.ln(18)
    else:
        pdf.ln(18)

    # --- Mentions légales (petit gris justifié) ---
    pdf.set_font("Body", "", 8)
    pdf.set_text_color(90, 90, 90)
    mentions = (
        "Quittance délivrée en application de l'article 21 de la loi n° 89-462 "
        "du 6 juillet 1989. "
        "Dont quittance, sous réserve de tous les droits et actions du propriétaire, de "
        "toutes poursuites qui auraient pu être engagées. En cas de congé précédemment "
        "donné, cette quittance représenterait une indemnité d'occupation des lieux et ne "
        "saurait être considérée comme un titre de location. Cette quittance annule tous "
        "les reçus qui auraient pu être donnés pour acomptes versés, même si ces reçus "
        "portent une date postérieure à la date ci-contre. Le paiement de la présente "
        "quittance n'emporte pas présomption de paiement des termes antérieurs."
    )
    pdf.multi_cell(0, 4, mentions, align="J")
    pdf.set_text_color(0, 0, 0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="Génère une (ou plusieurs) quittance(s) de loyer en PDF.")
    p.add_argument("--locataire", "-l", help="Nom (ou fragment) du locataire. Omettre + --tous = tous les locataires actuels.")
    p.add_argument("--tous", action="store_true", help="Tous les locataires actuels.")
    p.add_argument("--mois", "-m", nargs="+", help="Mois à générer : 'YYYY-MM' ou 'MM/YYYY' (un ou plusieurs).")
    p.add_argument("--du", help="Plage : début (YYYY-MM).")
    p.add_argument("--au", help="Plage : fin (YYYY-MM).")
    p.add_argument("--date-emission", help="Date d'émission (YYYY-MM-DD). Défaut : 3 du mois suivant.")
    p.add_argument("--date-paiement", help="Date de paiement (YYYY-MM-DD). Défaut : 2 du mois concerné.")
    p.add_argument("--moyen-paiement", help="Défaut : Virement bancaire.")
    p.add_argument("--output-dir", help=f"Dossier de sortie. Défaut : {OUTPUT_DIR}")
    p.add_argument("--dry-run", action="store_true", help="Affiche les variables sans générer.")
    args = p.parse_args()

    if args.tous:
        locataires = lister_locataires_actuels()
    elif args.locataire:
        loc = trouver_locataire(args.locataire)
        if loc is None:
            raise SystemExit(f"Locataire introuvable : {args.locataire}")
        locataires = [loc]
    else:
        raise SystemExit("Préciser --locataire NOM ou --tous.")

    periodes: list[tuple[int, int]] = []
    if args.du and args.au:
        periodes = plage_mois(args.du, args.au)
    elif args.mois:
        for m in args.mois:
            periodes.append(parse_mois(m))
    else:
        raise SystemExit("Préciser --mois YYYY-MM (un ou plusieurs) ou --du YYYY-MM --au YYYY-MM.")

    biens_cfg = charger_biens()
    out_dir = Path(args.output_dir) if args.output_dir else OUTPUT_DIR
    date_emission = dt.date.fromisoformat(args.date_emission) if args.date_emission else None
    date_paiement = dt.date.fromisoformat(args.date_paiement) if args.date_paiement else None

    generated = []
    for loc in locataires:
        for (annee, mois) in periodes:
            try:
                variables = variables_quittance(
                    loc, annee, mois, biens_cfg,
                    date_emission=date_emission,
                    date_paiement=date_paiement,
                    moyen_paiement=args.moyen_paiement,
                )
            except SystemExit as e:
                print(f"  ! {loc.nom_fichier} {annee}-{mois:02d} : {e}", file=sys.stderr)
                continue

            if args.dry_run:
                print(f"\n--- {loc.nom_fichier} {annee}-{mois:02d} ---")
                for k, val in variables.items():
                    print(f"  {k}: {val}")
                continue

            filename = f"Quittance-{loc.nom_fichier.replace(' ', '-')}-{annee}-{mois:02d}.pdf"
            out_path = out_dir / loc.nom_fichier / filename
            render_pdf(variables, out_path)
            generated.append(str(out_path))
            print(f"  OK {out_path}")

    if not args.dry_run:
        print(f"\n{len(generated)} quittance(s) generee(s).")


if __name__ == "__main__":
    main()
