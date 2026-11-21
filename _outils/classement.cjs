// Fabrique la page /la-bagarre-generale/classement/ dans le dossier publié (par défaut _site/).
// Lancé par .github/workflows/publication.yml : à chaque publication du site et toutes les 15 minutes.
// Lit la fonction publique classement_public_bagarre (migration 0048) avec la clé publique de l'app :
// rang, nom affiché (déjà masqué par la base), points, nombre de pronos ; 50 lignes au plus.
// La page reste du HTML statique : aucun script, aucun appel à Supabase depuis le navigateur des visiteurs.
// La page n'est JAMAIS commitée dans le dépôt (l'historique public garderait d'anciens pseudos) : elle n'existe que dans le site publié.
// Si le classement n'a pas changé depuis la page en ligne, on reprend la page en ligne telle quelle (même heure de dernier changement)
// et on écrit « change=false » dans $GITHUB_OUTPUT : la tâche planifiée ne republie alors rien.
// Essai hors ligne : node _outils/classement.cjs --essai donnees.json --sortie dossier
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const arg = (nom) => { const i = process.argv.indexOf(nom); return i > 0 ? process.argv[i + 1] : null; };
const SORTIE = path.resolve(arg('--sortie') || path.join(__dirname, '..', '_site'));
const GABARIT = path.join(__dirname, 'classement-gabarit.html');
const PAGE = path.join(SORTIE, 'la-bagarre-generale', 'classement', 'index.html');
const EN_LIGNE = 'https://dropleague.app/la-bagarre-generale/classement/';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Règle de vocabulaire du site : un pseudo qui contient un mot banni n'est pas publié (la base masque déjà le reste).
const BANNI = /pari|mise|miser|gain|cote|jackpot|argent|gratuit/i;
const sansAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const ANONYME = 'Joueur anonyme';
const nomPublic = (n) => (!n || BANNI.test(sansAccents(String(n)).replace(/Stade Fran.ais Paris/gi, '').replace(/Argentin[ae]?s?/gi, '')) ? ANONYME : String(n));
const pts = (n) => `${n} point${n > 1 ? 's' : ''}`;
// Remplacement littéral : jamais de motif spécial ($&, $', $`) tiré d'un pseudo.
const remplacer = (texte, marqueur, valeur) => { const morceaux = texte.split(marqueur); if (morceaux.length !== 2) throw new Error('marqueur ' + marqueur + ' absent ou en double'); return morceaux.join(valeur); };
const sortieGitHub = (cle, valeur) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${cle}=${valeur}\n`); };

async function lireClassement() {
  const essai = arg('--essai');
  if (essai) return JSON.parse(fs.readFileSync(essai, 'utf8'));
  const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_ANON_KEY;
  if (!url || !cle) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/classement_public_bagarre`, {
    method: 'POST', headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_limite: 50 }),
  });
  if (!r.ok) throw new Error(`Supabase a répondu ${r.status}`);
  const donnees = await r.json();
  if (!Array.isArray(donnees)) throw new Error('réponse inattendue de Supabase');
  return donnees;
}

async function pageEnLigne() {
  if (arg('--essai')) return null;
  try { const r = await fetch(EN_LIGNE, { headers: { 'Cache-Control': 'no-cache' } }); return r.ok ? await r.text() : null; } catch { return null; }
}

function heureDeParis(d) {
  const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  const v = (t) => f.find((x) => x.type === t).value;
  return `le ${v('day')} ${v('month')} à ${v('hour')} h ${v('minute')}`;
}

(async () => {
  const lignes = (await lireClassement()).slice(0, 50).map((l) => ({ rang: Number(l.rang) | 0, nom: nomPublic(l.nom), points: Number(l.points) | 0, nb: Number(l.nb_pronos) | 0 }));
  const gabarit = fs.readFileSync(GABARIT, 'utf8');
  const empreinte = crypto.createHash('sha256').update(JSON.stringify(lignes) + gabarit).digest('hex').slice(0, 16);
  fs.mkdirSync(path.dirname(PAGE), { recursive: true });

  const enLigne = await pageEnLigne();
  if (enLigne && enLigne.includes(`<meta name="dl-empreinte" content="${empreinte}">`)) {
    fs.writeFileSync(PAGE, enLigne);
    sortieGitHub('change', 'false');
    console.log('Classement inchangé depuis la page en ligne.');
    return;
  }

  const affiche = (l, i) => `<li class="carte${i === 0 ? ' ton-orange' : i === 1 ? ' ton-vert' : ''}">
    <div class="visuel"><span class="etiquette petites-capitales">${l.rang === 1 ? '1er' : l.rang + 'e'}</span>
      <div class="numero"><b>${l.rang}</b></div><div class="trait" aria-hidden="true"></div>
    </div>
    <h3 class="nom-carte${l.nom === ANONYME ? ' anonyme' : ''}">${esc(l.nom)}</h3><p class="prix">${pts(l.points)}</p></li>`;
  const podium = lignes.length ? `<ol class="podium">${lignes.slice(0, 3).map(affiche).join('')}</ol>` :
    '<p class="vide">Le classement s\'affiche dès les premiers points de la saison.</p>';
  const reste = lignes.slice(3);
  const tableau = reste.length ? `<div class="tableau classement"><table>
    <thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col" class="chiffre">Points</th><th scope="col" class="chiffre">Pronos</th></tr></thead>
    <tbody>${reste.map((l) => `<tr><td class="rang">${l.rang}</td><td class="joueur${l.nom === ANONYME ? ' anonyme' : ''}">${esc(l.nom)}</td><td class="chiffre">${l.points}</td><td class="chiffre">${l.nb}</td></tr>`).join('')}</tbody>
  </table></div>` : '';

  let page = gabarit;
  page = remplacer(page, '<!--DL-EMPREINTE-->', `<meta name="dl-empreinte" content="${empreinte}">`);
  page = remplacer(page, '<!--DL-NB-->', lignes.length ? `${lignes.length} joueur${lignes.length > 1 ? 's' : ''} classé${lignes.length > 1 ? 's' : ''}` : 'Aucun joueur classé');
  page = remplacer(page, '<!--DL-MAJ-->', heureDeParis(new Date()));
  page = remplacer(page, '<!--DL-PODIUM-->', podium);
  page = remplacer(page, '<!--DL-TABLEAU-->', tableau);
  fs.writeFileSync(PAGE, page);
  sortieGitHub('change', 'true');
  console.log(`Classement écrit : ${lignes.length} joueurs, empreinte ${empreinte}.`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
