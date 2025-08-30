# onhi

Static site for **오늘 할 일**.

## Deployment

The project is served directly from the repository root. The former `public/`
directory has been removed to avoid maintaining duplicate HTML files. When
deploying with Firebase Hosting, `firebase.json` is configured with
`"public": "."` so the root directory is published.
