# Mettre le site en ligne sur aventuretime.antoinequarroz.ch

Le site est un dossier de fichiers statiques (`dist/`, environ 14 Mo). Il suffit de le servir avec nginx.
Commandes prévues pour un VPS Debian ou Ubuntu, à lancer avec un utilisateur qui a `sudo`.

## 1. DNS (une fois)

Chez ton hébergeur DNS (là où est géré `antoinequarroz.ch`), ajoute :

| Type | Nom | Valeur |
| --- | --- | --- |
| A | `aventuretime` | l'adresse IPv4 du VPS |
| AAAA (si ton VPS a une IPv6) | `aventuretime` | l'adresse IPv6 du VPS |

Vérifie avec `dig +short aventuretime.antoinequarroz.ch` : l'IP du VPS doit s'afficher (quelques minutes, parfois plus).

## 2. nginx et le dossier du site (une fois, sur le VPS)

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx rsync
sudo mkdir -p /var/www/aventuretime
sudo chown "$USER":"$USER" /var/www/aventuretime
```

Copie la config `deploy/nginx-aventuretime.conf` du dépôt sur le VPS, puis :

```bash
sudo cp nginx-aventuretime.conf /etc/nginx/sites-available/aventuretime
sudo ln -s /etc/nginx/sites-available/aventuretime /etc/nginx/sites-enabled/aventuretime
sudo nginx -t && sudo systemctl reload nginx
```

## 3. HTTPS (une fois, après le DNS)

```bash
sudo certbot --nginx -d aventuretime.antoinequarroz.ch --redirect
```

Certbot ajoute le certificat, la redirection HTTP vers HTTPS, et le renouvelle tout seul.

## 4. Envoyer le site

Depuis ton ordinateur, à la racine du dépôt (il faut Node 20+, rsync et un accès SSH au VPS) :

```bash
DEPLOY_HOST=ip-du-vps DEPLOY_USER=ton-utilisateur ./deploy/deploy.sh
```

Le script construit le site (`npm ci` puis `npm run build`) et envoie `dist/` dans `/var/www/aventuretime`.
Options : `DEPLOY_PORT` (port SSH, 22 par défaut), `DEPLOY_PATH` (autre dossier), `SKIP_BUILD=1` (envoyer sans reconstruire).

Le site est en ligne sur https://aventuretime.antoinequarroz.ch.

## 5. Option : déploiement automatique à chaque push sur `main`

Le workflow `.github/workflows/deploy-vps.yml` fait l'étape 4 tout seul. Il ne fait rien tant que les secrets ne sont pas là.

1. Sur ton ordinateur, crée une clé réservée au déploiement :
   `ssh-keygen -t ed25519 -f ~/.ssh/aventuretime_deploy -N ""`
2. Ajoute la clé publique sur le VPS :
   `ssh-copy-id -i ~/.ssh/aventuretime_deploy.pub ton-utilisateur@ip-du-vps`
3. Sur GitHub, dans le dépôt : Settings > Secrets and variables > Actions > New repository secret :
   - `VPS_HOST` : l'IP du VPS
   - `VPS_USER` : ton utilisateur
   - `VPS_SSH_KEY` : le contenu de `~/.ssh/aventuretime_deploy` (la clé privée, sans `.pub`)
   - facultatif : `VPS_PORT` (si SSH n'est pas sur 22), `VPS_PATH` (si le dossier n'est pas `/var/www/aventuretime`)

Ensuite chaque push sur `main` met le site à jour. On peut aussi le lancer à la main dans l'onglet Actions (« Déploiement sur le VPS » > Run workflow).

## Ce que fait la config nginx

- Compression gzip du JS, du CSS et des modèles 3D (`.glb`), avec le bon type MIME pour les `.glb`.
- Cache d'un an pour `/assets/` (noms qui changent à chaque version), d'une semaine pour les modèles et les images.
- `index.html` toujours revalidé : une nouvelle version est visible tout de suite.
- Brotli prêt à activer (lignes commentées) si le module nginx est installé.

## En cas de souci

- `sudo nginx -t` indique l'erreur de config.
- `sudo tail /var/log/nginx/error.log` montre les erreurs de chargement.
- Page 403 : vérifie que `/var/www/aventuretime/index.html` existe et est lisible (`ls -la /var/www/aventuretime`).
