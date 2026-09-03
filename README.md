# Cuisine

Application web personnelle de recettes, courses et garde-manger, pensée mobile-first et adaptée au desktop.

## V3.4 — cuillères et pincées natives

Cuisine accepte maintenant les six unités de recette : `g`, `ml`, `unit`, `tbsp`, `tsp` et `pinch`.

- `tbsp` s’affiche comme **c. à soupe** ;
- `tsp` s’affiche comme **c. à café** ;
- `pinch` s’affiche comme **pincée** ;
- les portions multiplient correctement ces mesures ;
- le mode cuisine et les modifications de quantité les conservent ;
- le garde-manger sait comparer une recette en cuillères avec un stock en ml ;
- les courses fusionnent `tbsp`/`tsp` vers les ml et `pinch` vers les grammes ;
- conventions de conversion pour le stock et les courses : `1 tbsp = 15 ml`, `1 tsp = 5 ml`, `1 pinch ≈ 0,3 g` ;
- la consommation du stock reste FIFO par date de péremption, même si les unités de la recette et du lot diffèrent.

Pour les coûts estimés, `estimatedPrice` reste en €/kg pour `g`, €/L pour `ml`, €/unité pour `unit`, et en €/mesure pour `tbsp`, `tsp` et `pinch`.

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

## Mise à jour Oracle + GitHub

Pour déployer la V3.4 et pousser le même code sur GitHub en une seule commande :

```bash
./finaliser-v3.4.sh
```

Pour mettre à jour uniquement Oracle :

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
