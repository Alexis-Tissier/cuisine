# Cuisine

Application web personnelle de recettes, courses et garde-manger, pensée mobile-first et adaptée au desktop.

## V3.2 — comptes Authentik natifs

En production, Cuisine ne possède plus de sélecteur de compte interne.

- l'identité vient exclusivement de **Authentik** via Caddy ;
- l'API lit `X-Authentik-Uid`, `X-Authentik-Username`, `X-Authentik-Name` et `X-Authentik-Email` ;
- chaque identité Authentik possède son propre espace SQLite ;
- le navigateur ne peut plus demander `/api/users/tiphaine` ou `/api/users/alexis` : ces routes n'existent plus ;
- seul `/api/me/state` permet de lire ou modifier le profil authentifié ;
- en production, `CUISINE_REQUIRE_AUTH=1` fait refuser toute requête API qui n'a pas été authentifiée ;
- les anciennes données V3.1 `alexis` / `tiphaine` sont copiées automatiquement dans le nouveau profil Authentik lors de la première connexion, sans supprimer les anciennes clés.

## Fonctionnalités

- recettes normalisées pour 1 personne et portions recalculées automatiquement ;
- liste de courses fusionnée avec conditionnements modifiables ;
- garde-manger individuel avec lots séparés et péremptions ;
- suggestions « Qu'est-ce que je peux manger ? » ;
- priorité aux produits proches de la péremption ;
- mode cuisine, minuteurs et pesée réelle ;
- historique et possibilité de refaire exactement une préparation ;
- notifications ;
- backend FastAPI + SQLite ;
- interface responsive mobile / desktop.

## Production

- URL : `https://cuisine.alexis-tissier.fr`
- serveur applicatif : `oracle-server`
- service : `cuisine.service`
- écoute locale : `127.0.0.1:8092`
- base persistante : `/var/lib/cuisine/cuisine.sqlite3`
- reverse proxy + Authentik : Caddy

## Mise à jour Oracle

Depuis ce dossier :

```bash
./update-oracle-server.sh
```

Le script ne touche jamais à `/var/lib/cuisine` et vérifie que l'API refuse les accès sans identité Authentik.

## Développement local

Interface simple :

```bash
./start.sh
```

Backend local :

```bash
./run-server.sh
```

En local, Authentik n'est pas obligatoire par défaut. Pour reproduire le comportement de production :

```bash
CUISINE_REQUIRE_AUTH=1 ./run-server.sh
```

## Recettes IA

`AGENT_CUISINE_PROMPT.md` contient les instructions destinées à l'agent qui produit les fichiers recette `.txt` / JSON compatibles avec Cuisine.
