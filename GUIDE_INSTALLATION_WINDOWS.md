# CryptoTrack - Guide d'installation Windows 11

## 📋 Prérequis

- Windows 11 (ou Windows 10)
- Droits administrateur
- Connexion internet

## 🚀 Installation rapide (Automatique)

### Étape 1 : Télécharger les fichiers

Depuis l'interface Emergent, téléchargez ou copiez ces fichiers :
- `INSTALLER_WINDOWS.bat`
- `install_windows.ps1`
- `backend/server.py`
- `frontend/src/` (tout le dossier)

### Étape 2 : Lancer l'installation

1. Placez `INSTALLER_WINDOWS.bat` et `install_windows.ps1` dans le même dossier
2. **Clic droit** sur `INSTALLER_WINDOWS.bat` → **Exécuter en tant qu'administrateur**
3. Suivez les instructions à l'écran

### Étape 3 : Copier les fichiers source

Après l'installation, copiez :
- `server.py` → `C:\Users\VotreNom\CryptoTrack\backend\`
- `src\` → `C:\Users\VotreNom\CryptoTrack\frontend\`

### Étape 4 : Installer MongoDB

Double-cliquez sur `install_mongodb.bat` dans le dossier CryptoTrack

### Étape 5 : Lancer l'application

Double-cliquez sur `START_CRYPTOTRACK.bat`

---

## 🔧 Installation manuelle

### 1. Installer les prérequis

```powershell
# Python 3.11
winget install Python.Python.3.11

# Node.js LTS
winget install OpenJS.NodeJS.LTS

# MongoDB
winget install MongoDB.Server
```

### 2. Créer la structure

```
C:\Users\VotreNom\CryptoTrack\
├── backend\
│   ├── server.py
│   ├── requirements.txt
│   ├── .env
│   └── venv\
├── frontend\
│   ├── src\
│   ├── public\
│   ├── package.json
│   └── .env
└── data\
```

### 3. Configurer le Backend

```powershell
cd C:\Users\VotreNom\CryptoTrack\backend

# Créer l'environnement virtuel
python -m venv venv

# Activer l'environnement
.\venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt
```

**Fichier `.env` du backend :**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=crypto_portfolio
JWT_SECRET=votre_secret_jwt_a_changer
HOST=0.0.0.0
PORT=8001
```

### 4. Configurer le Frontend

```powershell
cd C:\Users\VotreNom\CryptoTrack\frontend

# Installer les dépendances
npm install
```

**Fichier `.env` du frontend :**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 5. Démarrer MongoDB

```powershell
# Démarrer le service MongoDB
net start MongoDB
```

### 6. Lancer l'application

**Terminal 1 - Backend :**
```powershell
cd C:\Users\VotreNom\CryptoTrack\backend
.\venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend :**
```powershell
cd C:\Users\VotreNom\CryptoTrack\frontend
npm start
```

### 7. Accéder à l'application

Ouvrez votre navigateur : **http://localhost:3000**

---

## 📁 Fichiers à copier depuis Emergent

| Fichier/Dossier | Destination |
|-----------------|-------------|
| `backend/server.py` | `CryptoTrack\backend\server.py` |
| `frontend/src/*` | `CryptoTrack\frontend\src\` |
| `frontend/src/components/ui/*` | `CryptoTrack\frontend\src\components\ui\` |

---

## ❓ Problèmes courants

### "python n'est pas reconnu"
→ Redémarrez PowerShell après l'installation de Python

### "MongoDB ne démarre pas"
→ Vérifiez que le service est installé : `Get-Service MongoDB`

### "Port 8001 déjà utilisé"
→ Changez le port dans `backend/.env` et `frontend/.env`

### "CORS errors"
→ Vérifiez que le backend est bien démarré sur le bon port

---

## 📞 Support

Pour toute question, consultez la documentation Emergent ou contactez le support.
