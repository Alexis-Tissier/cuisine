# Cuisine

Application web personnelle de recettes, courses et garde-manger, pensée mobile-first et adaptée au desktop.

## Fonctionnalités

- recettes normalisées pour 1 personne et portions recalculées automatiquement ;
- liste de courses fusionnée avec conditionnements modifiables ;
- garde-manger par compte et lots séparés par date de péremption ;
- suggestions « Qu'est-ce que je peux manger ? » et priorité aux produits qui périment ;
- mode cuisine avec étapes suivantes, minuteurs et pesée réelle ;
- historique et possibilité de refaire exactement une préparation ;
- notifications de péremption et de courses ;
- backend FastAPI + SQLite ;
- interface responsive mobile / desktop.

## Production

Instance personnelle : `cuisine.alexis-tissier.fr`.

Le service écoute localement sur `127.0.0.1:8092` et est publié via Caddy.

## Lancer en local

```bash
./start.sh
```

Ou avec le backend :

```bash
./run-server.sh
```

## Déploiement Oracle

```bash
./update-oracle-server.sh
```

La base `/var/lib/cuisine/cuisine.sqlite3` n'est jamais incluse dans Git.
