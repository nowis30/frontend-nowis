# Configuration des environnements

Chaque déploiement distant doit définir `VITE_API_URL` avant le build. Utiliser une API et une base de test pour Preview; réserver l'API réelle à Production. Le build refuse une URL absente, HTTP distante, ou contenant des identifiants. Le proxy local `/api` vers localhost:4000 reste disponible avec `npm run dev`.

La redirection Vercel vers un backend Render fixe a été retirée. Définir l'URL HTTPS de l'API dans les variables du projet Vercel, pour les environnements voulus, avant de fusionner cette modification. Ne pas recopier l'URL de production dans Preview.

L'inscription publique est masquée par défaut. `VITE_ALLOW_PUBLIC_REGISTRATION=true` l'affiche seulement si le backend a aussi activé `ALLOW_PUBLIC_REGISTRATION=true`; un compte ainsi créé ne reçoit aucun droit administratif.

Une session expirée est invalidée sur 401, et les requêtes mises en cache sont annulées et effacées au changement de session. Les réponses tardives d'une ancienne session ne déconnectent pas la nouvelle.

Validation : `npm test -- --run src/api/__tests__/sessionBoundary.test.ts`, puis `VITE_API_URL=https://api.example.invalid npm run build`. Cette URL de test est volontairement non exploitable et n'est pas une configuration de production.
