/* =============================================================
   ISSA Capital — Admin UI (vanilla JS, no framework)

   Router hash simple : #contacts, #cr, #drafts, #logs, #settings
   Helpers fetch, rendu DOM, formulaires.
   ============================================================= */

(function () {
  'use strict';

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function api(method, path, body) {
    var opts = {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        throw new Error('unauthorized');
      }
      return res.json().then(function (json) {
        if (!res.ok) {
          var err = new Error(json.error || 'Erreur API');
          err.status = res.status;
          err.code = json.code;
          err.details = json.details;
          throw err;
        }
        return json;
      });
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on')
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      children.forEach(function (c) {
        if (c === null || c === undefined) return;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }
    return node;
  }

  function loadTemplate(id) {
    var tpl = document.getElementById(id);
    if (!tpl) throw new Error('Template ' + id + ' introuvable');
    return tpl.content.cloneNode(true);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return (
        d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR').slice(0, 5)
      );
    } catch (e) {
      return iso;
    }
  }

  function badge(text, kind) {
    return el(
      'span',
      { class: 'badge badge-' + (kind || text) },
      [text],
    );
  }

  function empty(msg) {
    return el('div', { class: 'empty' }, [msg]);
  }

  function loading() {
    return el('div', { class: 'loading' }, ['Chargement...']);
  }

  // ------------------------------------------------------------
  // Session check + logout
  // ------------------------------------------------------------

  function checkSession() {
    return api('GET', '/admin/api/me')
      .then(function (me) {
        var label = document.getElementById('user-label');
        if (label) label.textContent = me.sub + ' · ' + me.role;
        return me;
      })
      .catch(function () {
        window.location.href = '/admin/login.html';
      });
  }

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
      }).finally(function () {
        window.location.href = '/admin/login.html';
      });
    });
  }

  // ------------------------------------------------------------
  // Router hash
  // ------------------------------------------------------------

  var routes = {
    contacts: renderContacts,
    cr: renderCR,
    drafts: renderDrafts,
    logs: renderLogs,
    settings: renderSettings,
  };

  function currentRoute() {
    var h = (window.location.hash || '#contacts').slice(1);
    if (!routes[h]) h = 'contacts';
    return h;
  }

  function updateActiveTab(route) {
    var tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(function (t) {
      if (t.getAttribute('data-tab') === route) t.classList.add('active');
      else t.classList.remove('active');
    });
  }

  function route() {
    var r = currentRoute();
    updateActiveTab(r);
    var app = document.getElementById('app');
    app.innerHTML = '';
    routes[r](app);
  }

  window.addEventListener('hashchange', route);

  // ------------------------------------------------------------
  // Module Contacts
  // ------------------------------------------------------------

  function renderContacts(app) {
    var frag = loadTemplate('tpl-contacts');
    app.appendChild(frag);
    var listEl = document.getElementById('contacts-list');
    var searchEl = document.getElementById('contacts-search');
    var newBtn = document.getElementById('contacts-new');

    function loadContacts(q) {
      listEl.innerHTML = '';
      listEl.appendChild(loading());
      var url = '/admin/api/contacts';
      if (q) url += '?q=' + encodeURIComponent(q);
      api('GET', url)
        .then(function (data) {
          listEl.innerHTML = '';
          if (!data.items.length) {
            listEl.appendChild(empty('Aucun contact.'));
            return;
          }
          var table = el('table', { class: 'data' });
          var thead = el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Nom']),
              el('th', {}, ['Titre / Société']),
              el('th', {}, ['Email']),
              el('th', {}, ['Téléphone']),
              el('th', {}, ['WhatsApp']),
              el('th', {}, ['']),
            ]),
          ]);
          table.appendChild(thead);
          var tbody = el('tbody');
          data.items.forEach(function (c) {
            var tr = el('tr', {}, [
              el('td', {}, [c.prenom + ' ' + c.nom]),
              el('td', {}, [
                [c.titre, c.societe].filter(Boolean).join(' · ') || '—',
              ]),
              el('td', { class: 'cell-mono' }, [c.email || '—']),
              el('td', { class: 'cell-mono' }, [c.telephone || '—']),
              el(
                'td',
                {},
                [
                  c.whatsappAuthorized ? badge('Autorisé', 'success') : '—',
                ],
              ),
              el('td', { class: 'row-actions' }, [
                el(
                  'button',
                  {
                    class: 'btn btn-ghost',
                    onClick: function () {
                      openContactForm(c, function () {
                        loadContacts(searchEl.value);
                      });
                    },
                  },
                  ['Éditer'],
                ),
                el(
                  'button',
                  {
                    class: 'btn btn-ghost',
                    onClick: function () {
                      if (
                        window.confirm(
                          'Supprimer (soft) ' + c.prenom + ' ' + c.nom + ' ?',
                        )
                      ) {
                        api('DELETE', '/admin/api/contacts/' + c.id)
                          .then(function () {
                            loadContacts(searchEl.value);
                          })
                          .catch(function (err) {
                            alert('Erreur : ' + err.message);
                          });
                      }
                    },
                  },
                  ['Supprimer'],
                ),
              ]),
            ]);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          listEl.appendChild(table);
          var pag = el('div', { class: 'pagination' }, [
            'Total : ' + data.total + ' · Page ' + data.page,
          ]);
          listEl.appendChild(pag);
        })
        .catch(function (err) {
          listEl.innerHTML = '';
          listEl.appendChild(empty('Erreur : ' + err.message));
        });
    }

    var searchTimer;
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        loadContacts(searchEl.value);
      }, 250);
    });

    newBtn.addEventListener('click', function () {
      openContactForm(null, function () {
        loadContacts(searchEl.value);
      });
    });

    loadContacts('');
  }

  function openContactForm(contact, onSave) {
    var frag = loadTemplate('tpl-contact-form');
    var form = frag.querySelector('form');
    var title = frag.querySelector('#contact-form-title');
    var errorEl = frag.querySelector('#contact-error');
    var cancelBtn = frag.querySelector('#contact-cancel');

    if (contact) {
      title.textContent = 'Éditer ' + contact.prenom + ' ' + contact.nom;
      form.prenom.value = contact.prenom || '';
      form.nom.value = contact.nom || '';
      form.titre.value = contact.titre || '';
      form.societe.value = contact.societe || '';
      form.email.value = contact.email || '';
      form.telephone.value = contact.telephone || '';
      form.notes.value = contact.notes || '';
      form.whatsappAuthorized.checked = !!contact.whatsappAuthorized;
      (contact.entitesVisibles || []).forEach(function (ent) {
        var cb = form.querySelector('input[name="entites"][value="' + ent + '"]');
        if (cb) cb.checked = true;
      });
    }

    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(frag);

    cancelBtn.addEventListener('click', function () {
      route();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.hidden = true;

      var entites = Array.from(
        form.querySelectorAll('input[name="entites"]:checked'),
      ).map(function (cb) {
        return cb.value;
      });

      var payload = {
        prenom: form.prenom.value.trim(),
        nom: form.nom.value.trim(),
        titre: form.titre.value.trim() || null,
        societe: form.societe.value.trim() || null,
        email: form.email.value.trim() || null,
        telephone: form.telephone.value.trim() || null,
        whatsappAuthorized: form.whatsappAuthorized.checked,
        entitesVisibles: entites,
        notes: form.notes.value.trim() || null,
      };

      var req;
      if (contact) {
        req = api('PATCH', '/admin/api/contacts/' + contact.id, payload);
      } else {
        req = api('POST', '/admin/api/contacts', payload);
      }

      req
        .then(function () {
          if (onSave) onSave();
          window.location.hash = 'contacts';
          route();
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Erreur';
          errorEl.hidden = false;
        });
    });
  }

  // ------------------------------------------------------------
  // Module CR publiés
  // ------------------------------------------------------------

  function renderCR(app) {
    var frag = loadTemplate('tpl-cr');
    app.appendChild(frag);
    var listEl = document.getElementById('cr-list');
    var entityEl = document.getElementById('cr-entity');
    var fromEl = document.getElementById('cr-from');
    var toEl = document.getElementById('cr-to');

    function load() {
      listEl.innerHTML = '';
      listEl.appendChild(loading());
      var params = [];
      if (entityEl.value) params.push('entity=' + entityEl.value);
      if (fromEl.value) params.push('from=' + fromEl.value);
      if (toEl.value) params.push('to=' + toEl.value);
      var url =
        '/admin/api/published' + (params.length ? '?' + params.join('&') : '');
      api('GET', url)
        .then(function (data) {
          listEl.innerHTML = '';
          if (!data.items.length) {
            listEl.appendChild(empty('Aucun CR publié.'));
            return;
          }
          var table = el('table', { class: 'data' });
          table.appendChild(
            el('thead', {}, [
              el('tr', {}, [
                el('th', {}, ['Référence']),
                el('th', {}, ['Entité']),
                el('th', {}, ['Type']),
                el('th', {}, ['Date réunion']),
                el('th', {}, ['Publié le']),
                el('th', {}, ['Craft']),
              ]),
            ]),
          );
          var tbody = el('tbody');
          data.items.forEach(function (cr) {
            var tr = el('tr', {}, [
              el('td', { class: 'cell-mono' }, [cr.reference]),
              el('td', {}, [badge(cr.entite, cr.entite)]),
              el('td', {}, [cr.typeReunion]),
              el('td', {}, [cr.dateReunion]),
              el('td', {}, [formatDate(cr.dateEtablissement)]),
              el('td', {}, [
                el(
                  'a',
                  { href: cr.craftUrl, target: '_blank', rel: 'noopener' },
                  ['Ouvrir'],
                ),
              ]),
            ]);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          listEl.appendChild(table);
          listEl.appendChild(
            el('div', { class: 'pagination' }, [
              'Total : ' + data.total + ' · Page ' + data.page,
            ]),
          );
        })
        .catch(function (err) {
          listEl.innerHTML = '';
          listEl.appendChild(empty('Erreur : ' + err.message));
        });
    }

    entityEl.addEventListener('change', load);
    fromEl.addEventListener('change', load);
    toEl.addEventListener('change', load);
    load();
  }

  // ------------------------------------------------------------
  // Module Brouillons
  // ------------------------------------------------------------

  function renderDrafts(app) {
    var frag = loadTemplate('tpl-drafts');
    app.appendChild(frag);
    var listEl = document.getElementById('drafts-list');
    var statusEl = document.getElementById('drafts-status');

    function load() {
      listEl.innerHTML = '';
      listEl.appendChild(loading());
      var url = '/admin/api/drafts';
      if (statusEl.value) url += '?status=' + statusEl.value;
      api('GET', url)
        .then(function (data) {
          listEl.innerHTML = '';
          if (!data.items.length) {
            listEl.appendChild(empty('Aucun brouillon.'));
            return;
          }
          var table = el('table', { class: 'data' });
          table.appendChild(
            el('thead', {}, [
              el('tr', {}, [
                el('th', {}, ['ID']),
                el('th', {}, ['Statut']),
                el('th', {}, ['Entité']),
                el('th', {}, ['Type']),
                el('th', {}, ['Auteur']),
                el('th', {}, ['Créé']),
              ]),
            ]),
          );
          var tbody = el('tbody');
          data.items.forEach(function (d) {
            var tr = el('tr', {}, [
              el('td', { class: 'cell-mono' }, [d.id.slice(0, 8)]),
              el('td', {}, [badge(d.status, d.status)]),
              el('td', {}, [d.entite ? badge(d.entite, d.entite) : '—']),
              el('td', {}, [d.typeReunion || '—']),
              el('td', { class: 'cell-mono' }, [d.userPhone]),
              el('td', {}, [formatDate(d.createdAt)]),
            ]);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          listEl.appendChild(table);
          listEl.appendChild(
            el('div', { class: 'pagination' }, [
              'Total : ' + data.total + ' · Page ' + data.page,
            ]),
          );
        })
        .catch(function (err) {
          listEl.innerHTML = '';
          listEl.appendChild(empty('Erreur : ' + err.message));
        });
    }

    statusEl.addEventListener('change', load);
    load();
  }

  // ------------------------------------------------------------
  // Module Logs
  // ------------------------------------------------------------

  var currentLogsTab = 'access';

  function renderLogs(app) {
    var frag = loadTemplate('tpl-logs');
    app.appendChild(frag);
    var listEl = document.getElementById('logs-list');
    var statsEl = document.getElementById('logs-stats');
    var tabs = document.querySelectorAll('.logs-tab');

    function switchTab(tab) {
      currentLogsTab = tab;
      tabs.forEach(function (t) {
        if (t.getAttribute('data-logs-tab') === tab) t.classList.add('active');
        else t.classList.remove('active');
      });
      if (tab === 'generation') loadGenerationStats();
      else statsEl.innerHTML = '';
      load();
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        switchTab(t.getAttribute('data-logs-tab'));
      });
    });

    function loadGenerationStats() {
      statsEl.innerHTML = '';
      api('GET', '/admin/api/logs/generation/stats')
        .then(function (stats) {
          statsEl.innerHTML = '';
          var cards = [
            ['Appels 30j', stats.totalCalls],
            ['Coût 30j ($)', stats.totalCostUsd.toFixed(3)],
            ['Tokens in', stats.totalPromptTokens],
            ['Tokens out', stats.totalCompletionTokens],
            ['Latence moy (ms)', stats.avgLatencyMs],
            ['Erreurs', stats.errors],
          ];
          cards.forEach(function (c) {
            statsEl.appendChild(
              el('div', { class: 'stat-card' }, [
                el('div', { class: 'stat-card-label' }, [c[0]]),
                el('div', { class: 'stat-card-value' }, [String(c[1])]),
              ]),
            );
          });
        })
        .catch(function () {
          statsEl.innerHTML = '';
        });
    }

    function load() {
      listEl.innerHTML = '';
      listEl.appendChild(loading());
      var url = '/admin/api/logs/' + currentLogsTab;
      api('GET', url)
        .then(function (data) {
          listEl.innerHTML = '';
          if (!data.items.length) {
            listEl.appendChild(empty('Aucun log.'));
            return;
          }
          var table = el('table', { class: 'data' });
          if (currentLogsTab === 'access') {
            table.appendChild(
              el('thead', {}, [
                el('tr', {}, [
                  el('th', {}, ['Timestamp']),
                  el('th', {}, ['Acteur']),
                  el('th', {}, ['Action']),
                  el('th', {}, ['Ressource']),
                  el('th', {}, ['Entité']),
                  el('th', {}, ['Résultat']),
                ]),
              ]),
            );
            var tbody = el('tbody');
            data.items.forEach(function (log) {
              tbody.appendChild(
                el('tr', {}, [
                  el('td', {}, [formatDate(log.timestamp)]),
                  el('td', { class: 'cell-mono' }, [
                    log.actorDisplayName || log.actorPhone,
                  ]),
                  el('td', {}, [log.action]),
                  el('td', { class: 'cell-mono' }, [
                    log.resourceType + ':' + log.resourceId.slice(0, 8),
                  ]),
                  el('td', {}, [log.entite ? badge(log.entite, log.entite) : '—']),
                  el('td', {}, [badge(log.result, log.result)]),
                ]),
              );
            });
            table.appendChild(tbody);
          } else {
            table.appendChild(
              el('thead', {}, [
                el('tr', {}, [
                  el('th', {}, ['Timestamp']),
                  el('th', {}, ['Draft']),
                  el('th', {}, ['Modèle']),
                  el('th', {}, ['Tokens']),
                  el('th', {}, ['Coût ($)']),
                  el('th', {}, ['Latence']),
                  el('th', {}, ['Statut']),
                ]),
              ]),
            );
            var tbody2 = el('tbody');
            data.items.forEach(function (log) {
              tbody2.appendChild(
                el('tr', {}, [
                  el('td', {}, [formatDate(log.timestamp)]),
                  el('td', { class: 'cell-mono' }, [
                    log.draftId ? log.draftId.slice(0, 8) : '—',
                  ]),
                  el('td', {}, [log.claudeModel]),
                  el('td', {}, [
                    (log.promptTokens || 0) + ' / ' + (log.completionTokens || 0),
                  ]),
                  el('td', {}, [
                    log.costUsd != null ? log.costUsd.toFixed(4) : '—',
                  ]),
                  el('td', {}, [
                    log.latencyMs != null ? log.latencyMs + ' ms' : '—',
                  ]),
                  el('td', {}, [badge(log.status, log.status)]),
                ]),
              );
            });
            table.appendChild(tbody2);
          }
          listEl.appendChild(table);
          listEl.appendChild(
            el('div', { class: 'pagination' }, [
              'Total : ' + data.total + ' · Page ' + data.page,
            ]),
          );
        })
        .catch(function (err) {
          listEl.innerHTML = '';
          listEl.appendChild(empty('Erreur : ' + err.message));
        });
    }

    switchTab('access');
  }

  // ------------------------------------------------------------
  // Module Settings
  // ------------------------------------------------------------

  function renderSettings(app) {
    var frag = loadTemplate('tpl-settings');
    app.appendChild(frag);
    loadWhitelist();
    loadSignature();
    loadCostAlert();
    loadEntities();
    setupWhitelistForm();
    setupSignatureUpload();
    setupCostAlertForm();
    setupEntitiesForm();
  }

  function loadWhitelist() {
    var el2 = document.getElementById('whitelist-list');
    el2.innerHTML = '';
    el2.appendChild(loading());
    api('GET', '/admin/api/settings/whitelist')
      .then(function (data) {
        el2.innerHTML = '';
        if (!data.items.length) {
          el2.appendChild(empty('Whitelist vide.'));
          return;
        }
        var list = el('table', { class: 'data' });
        list.appendChild(
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Numéro']),
              el('th', {}, ['Nom']),
              el('th', {}, ['Entités']),
              el('th', {}, ['Admin']),
              el('th', {}, ['Révoqué']),
              el('th', {}, ['']),
            ]),
          ]),
        );
        var tbody = el('tbody');
        data.items.forEach(function (w) {
          tbody.appendChild(
            el('tr', {}, [
              el('td', { class: 'cell-mono' }, [w.phoneE164]),
              el('td', {}, [w.displayName]),
              el('td', {}, [w.entitesVisibles.join(', ')]),
              el('td', {}, [w.isAdmin ? 'oui' : '—']),
              el('td', {}, [w.revokedAt ? formatDate(w.revokedAt) : '—']),
              el('td', { class: 'row-actions' }, [
                el(
                  'button',
                  {
                    class: 'btn btn-ghost',
                    onClick: function () {
                      if (window.confirm('Révoquer ' + w.phoneE164 + ' ?')) {
                        api(
                          'DELETE',
                          '/admin/api/settings/whitelist/' +
                            encodeURIComponent(w.phoneE164),
                        )
                          .then(loadWhitelist)
                          .catch(function (err) {
                            alert('Erreur : ' + err.message);
                          });
                      }
                    },
                  },
                  ['Révoquer'],
                ),
              ]),
            ]),
          );
        });
        list.appendChild(tbody);
        el2.appendChild(list);
      })
      .catch(function (err) {
        el2.innerHTML = '';
        el2.appendChild(empty('Erreur : ' + err.message));
      });
  }

  function setupWhitelistForm() {
    var form = document.getElementById('whitelist-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var entites = ['IC', 'GO', 'VI', 'VV'].filter(function (ent) {
        return form.querySelector('input[name="' + ent + '"]').checked;
      });
      if (!entites.length) {
        alert('Sélectionner au moins une entité');
        return;
      }
      api('POST', '/admin/api/settings/whitelist', {
        phoneE164: form.phoneE164.value.trim(),
        displayName: form.displayName.value.trim(),
        entitesVisibles: entites,
      })
        .then(function () {
          form.reset();
          loadWhitelist();
        })
        .catch(function (err) {
          alert('Erreur : ' + err.message);
        });
    });
  }

  function loadSignature() {
    var el2 = document.getElementById('signature-preview');
    el2.innerHTML = '';
    api('GET', '/admin/api/settings/signature')
      .then(function (data) {
        if (data.exists) {
          el2.appendChild(
            el('img', {
              src: data.url + '?t=' + Date.now(),
              alt: 'Signature',
            }),
          );
          el2.appendChild(
            el('div', { class: 'hint' }, [
              data.sizeBytes + ' octets · MAJ : ' + formatDate(data.updatedAt),
            ]),
          );
        } else {
          el2.appendChild(empty('Pas de signature uploadée.'));
        }
      })
      .catch(function () {
        el2.appendChild(empty('Pas de signature uploadée.'));
      });
  }

  function setupSignatureUpload() {
    var fileInput = document.getElementById('signature-file');
    var deleteBtn = document.getElementById('signature-delete');

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        alert('Fichier trop volumineux (max 500 KB)');
        return;
      }
      fetch('/admin/api/settings/signature', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'image/png' },
        body: file,
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { status: res.status, body: body };
          });
        })
        .then(function (result) {
          if (result.status === 200) {
            loadSignature();
          } else {
            alert(
              'Erreur : ' + (result.body.error || 'upload échoué'),
            );
          }
        });
    });

    deleteBtn.addEventListener('click', function () {
      if (!window.confirm('Supprimer la signature ?')) return;
      api('DELETE', '/admin/api/settings/signature')
        .then(loadSignature)
        .catch(function (err) {
          alert('Erreur : ' + err.message);
        });
    });
  }

  function loadCostAlert() {
    api('GET', '/admin/api/settings/cost-alert').then(function (data) {
      var form = document.getElementById('cost-alert-form');
      if (form) form.threshold.value = data.thresholdMonthlyEur;
    });
  }

  function setupCostAlertForm() {
    var form = document.getElementById('cost-alert-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      api('PATCH', '/admin/api/settings/cost-alert', {
        thresholdMonthlyEur: Number(form.threshold.value),
      })
        .then(function () {
          alert('Seuil enregistré');
        })
        .catch(function (err) {
          alert('Erreur : ' + err.message);
        });
    });
  }

  function loadEntities() {
    api('GET', '/admin/api/settings/entities').then(function (data) {
      var form = document.getElementById('entities-form');
      if (!form) return;
      ['IC', 'GO', 'VI', 'VV'].forEach(function (ent) {
        form.querySelector('input[name="' + ent + '"]').checked =
          data.entities.indexOf(ent) !== -1;
      });
    });
  }

  function setupEntitiesForm() {
    var form = document.getElementById('entities-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var entities = ['IC', 'GO', 'VI', 'VV'].filter(function (ent) {
        return form.querySelector('input[name="' + ent + '"]').checked;
      });
      if (!entities.length) {
        alert('Sélectionner au moins une entité');
        return;
      }
      api('PATCH', '/admin/api/settings/entities', { entities: entities })
        .then(function () {
          alert('Entités enregistrées');
        })
        .catch(function (err) {
          alert('Erreur : ' + err.message);
        });
    });
  }

  // ------------------------------------------------------------
  // Bootstrap
  // ------------------------------------------------------------

  checkSession().then(function (me) {
    if (!me) return;
    if (!window.location.hash) window.location.hash = 'contacts';
    route();
  });
})();
