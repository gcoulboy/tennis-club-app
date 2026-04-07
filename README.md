# 🎾 Tennis Club — Compta & Snack v2

Application fusionnée : gestion comptable des tournois + gestion snack-bar.
Déploiement via Docker sur NAS Synology.

## Fonctionnalités

### Comptabilité tournoi
- Création de tournois avec code homologation, juge arbitre, part JA
- Inscriptions joueurs avec mode de paiement (CB, espèces, en ligne, chèque)
- Dépenses par tournoi (taxe comité, balles, buffet, etc.)
- Dotations par classement (1/4, 1/2, finaliste, vainqueur) — hommes & femmes
- Bilan complet avec calcul automatique du bénéfice et répartition JA/club

### Snack-bar
- Gestion des produits avec codes-barres
- Achats (approvisionnement) et mise à jour du stock
- Ventes par tournoi avec mode de paiement (espèces / CB)
- Mode caisse rapide avec scan code-barres (caméra smartphone)

### Bilan unifié
- Vue complète recettes (inscriptions + snack) vs dépenses (frais + dotations)
- Marge snack (CA - coût des marchandises vendues)
- Détail des ventes snack par produit
- État du stock en temps réel

---

## Migration depuis v1

Si vous avez déjà la v1 (snack seul) déployée, la base de données sera
automatiquement migrée. Les nouvelles tables (inscriptions, depenses,
dotations) et colonnes (code_homologation, juge_arbitre, part_ja) sont
ajoutées sans toucher aux données existantes.

```bash
# 1. Arrêter la v1
cd /volume1/docker/tennis-club-app
docker-compose down

# 2. Sauvegarder la base
cp data/tennis.db data/tennis.db.backup

# 3. Remplacer les fichiers par la v2
# (transférer l'archive v2 et décompresser)

# 4. Relancer
docker-compose up -d --build
```

---

## Déploiement neuf

```bash
# Transférer sur le NAS
scp -r tennis-club-app-v2/ admin@IP-NAS:/volume1/docker/tennis-club-app/

# Se connecter en SSH
ssh admin@IP-NAS
cd /volume1/docker/tennis-club-app

# ⚠️ Modifier le JWT_SECRET dans docker-compose.yml

# Lancer
docker-compose up -d --build
```

Accès : http://IP-NAS:3000
Compte par défaut : `admin` / `admin123` — changez le mot de passe immédiatement.

---

## Structure

```
tennis-club-app-v2/
├── backend/
│   ├── server.js            # Point d'entrée Express
│   ├── package.json
│   ├── db/database.js       # SQLite (sql.js) + schéma fusionné
│   ├── middleware/auth.js    # JWT auth
│   └── routes/
│       ├── auth.js           # Login, profil
│       ├── users.js          # CRUD utilisateurs
│       ├── products.js       # CRUD produits snack
│       ├── operations.js     # Tournois, achats, ventes, dashboard
│       └── compta.js         # Inscriptions, dépenses, dotations, bilan
├── frontend/
│   ├── index.html
│   ├── css/main.css
│   └── js/
│       ├── api.js            # Client API
│       ├── ui.js             # Utilitaires UI
│       ├── app.js            # Navigation / routeur
│       └── pages/
│           ├── login.js
│           ├── dashboard.js
│           ├── compta.js     # Inscriptions + dépenses + dotations
│           ├── bilan.js      # Bilan complet unifié
│           ├── caisse.js     # Mode caisse rapide
│           ├── products.js
│           ├── purchases.js
│           ├── sales.js
│           └── users.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```
