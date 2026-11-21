# Outils du site (dossier non publié)

- `.github/workflows/publication.yml` publie le site par GitHub Pages, dont la source est « GitHub Actions ». Il tourne à chaque push sur main et toutes les 15 minutes.
- `classement.cjs` fabrique la page `/la-bagarre-generale/classement/` dans `_site/`, depuis la fonction publique `classement_public_bagarre` de la migration 0048. La base recalcule le top 50 toutes les 10 minutes et masque elle-même les pseudos d'origine, les pseudos refusés par le filtre et les joueurs qui s'y sont opposés.
- Cette page n'est **jamais commitée** : l'historique public du dépôt ne doit garder aucun pseudo. Elle est dans `.gitignore`.
- `classement-gabarit.html` est fabriqué par le générateur du site (construire-classement.cjs). Ne pas le modifier à la main.
- **Droit d'opposition** (demande à contact@dropleague.app) : une ligne dans la table `classement_public_refus` de la base, avec l'identifiant du compte, que l'on retrouve à partir de l'adresse e-mail de la demande. Le joueur apparaît en « Joueur anonyme » au recalcul suivant, 10 minutes au plus.
- Secrets du dépôt : `SUPABASE_URL` et `SUPABASE_ANON_KEY` (la clé publique de l'app).
