Render deployment quick steps

1. Create a Render account at https://render.com and connect your GitHub account.
2. In Render dashboard choose "New +" → "Web Service" and select the repository `shrunkhal2005/ML-model`.
3. Use these options when prompted:
   - Branch: `main`
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `gunicorn -k uvicorn.workers.UvicornWorker backend.main:app --bind 0.0.0.0:$PORT`
   - Environment: `Python 3`
4. Alternatively, let Render detect the `render.yaml` we added — it will create the `ml-model-backend` service automatically.
5. After deploy, note the service URL (e.g. `https://ml-model-backend.onrender.com`) and update the frontend API base if you host the frontend elsewhere.

Updating frontend to use Render URL

If you deploy the frontend on Vercel or serve it statically, edit `frontend/index.html` and set `apiBase` to your Render URL. The file already prefers local host when run locally; for production you can set `apiBase = 'https://<your-render-service>.onrender.com'`.
