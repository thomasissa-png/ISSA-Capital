/**
 * Page /admin/login.html — vanilla JS externalisé pour CSP strict (Phase 6).
 *
 * Responsabilités :
 *  - Si déjà authentifié (cookie admin_session valide), redirige vers dashboard
 *  - Soumet le formulaire POST /admin/login et gère la réponse
 *  - Si 2FA activée, affiche la modale TOTP et appelle /admin/api/2fa/verify-login
 *
 * Note 2FA : en V1 initiale (pas encore activée), le serveur retourne directement
 * le JWT au premier POST. Quand l'admin active la 2FA via le dashboard,
 * le serveur retourne { requires_2fa: true, temp_token } et ce script ouvre
 * un prompt TOTP.
 */
(function () {
  var form = document.getElementById('login-form');
  var errorEl = document.getElementById('error-message');
  var submitBtn = document.getElementById('submit-btn');

  // Si déjà authentifié, rediriger vers le dashboard
  fetch('/admin/api/me', { credentials: 'same-origin' })
    .then(function (r) {
      if (r.ok) {
        window.location.href = '/admin/dashboard.html';
      }
    })
    .catch(function () {
      // pas grave — on reste sur login
    });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }

  function prompt2fa(tempToken) {
    // Prompt simple : une boîte de dialogue navigateur. Sobre, suffisant V1.
    var code = window.prompt('Code d\'authentification 2FA (6 chiffres) :');
    if (code === null || code === '') {
      showError('Code 2FA requis.');
      return;
    }
    fetch('/admin/api/2fa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ temp_token: tempToken, code: code }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.status === 200 && result.body.success) {
          window.location.href = '/admin/dashboard.html';
        } else {
          showError(
            (result.body && result.body.error) || 'Code 2FA invalide.',
          );
        }
      })
      .catch(function () {
        showError('Erreur réseau — vérifier la connexion.');
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    var password = document.getElementById('password').value;

    fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.status === 200 && result.body.success) {
          if (result.body.requires_2fa === true) {
            // Prompt TOTP
            prompt2fa(result.body.temp_token);
          } else {
            window.location.href = '/admin/dashboard.html';
          }
        } else {
          showError(
            (result.body && result.body.error) ||
              'Connexion impossible, réessayer.',
          );
        }
      })
      .catch(function () {
        showError('Erreur réseau — vérifier la connexion.');
      });
  });
})();
