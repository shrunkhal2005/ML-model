import io
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.utils import resample

APP_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = APP_DIR / "health_lifestyle_dataset.csv"

app = FastAPI(title="Health Lifestyle Prediction API")

# Allow local frontend ports for demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    age: float
    gender: str
    bmi: float
    daily_steps: float
    sleep_hours: float
    water_intake_l: float
    calories_consumed: float
    smoker: int
    alcohol: int
    resting_hr: float
    systolic_bp: float
    diastolic_bp: float
    cholesterol: float
    family_history: int


def balance_train(df_train: pd.DataFrame):
    maj = df_train[df_train.disease_risk == 0]
    min_ = df_train[df_train.disease_risk == 1]
    target = len(maj) // 2
    min_up = resample(min_, replace=True, n_samples=target, random_state=42)
    maj_down = resample(maj, replace=False, n_samples=target, random_state=42)
    bal = pd.concat([maj_down, min_up]).sample(frac=1, random_state=42)
    return bal.drop('disease_risk', axis=1), bal['disease_risk']


def train_models():
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=['disease_risk'])
    if 'id' in df.columns:
        df = df.drop('id', axis=1)

    cat_cols = df.select_dtypes(include='object').columns.tolist()
    le_dict = {}
    for c in cat_cols:
        le = LabelEncoder()
        df[c] = le.fit_transform(df[c].astype(str))
        le_dict[c] = le

    X = df.drop('disease_risk', axis=1)
    y = df['disease_risk']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    num_cols = X_train.select_dtypes(include=np.number).columns.tolist()
    scaler = MinMaxScaler()
    X_train[num_cols] = scaler.fit_transform(X_train[num_cols])
    X_test[num_cols] = scaler.transform(X_test[num_cols])

    X_train_bal, y_train_bal = balance_train(pd.concat([X_train, y_train], axis=1))

    rf = RandomForestClassifier(n_estimators=150, random_state=42)
    rf.fit(X_train_bal, y_train_bal)

    dt_acc = accuracy_score(y_test, rf.predict(X_test))
    dt_f1 = f1_score(y_test, rf.predict(X_test), pos_label=1)

    return rf, scaler, X_train_bal.columns.tolist(), (dt_acc, dt_f1), le_dict


# Train on startup
if not DATA_PATH.exists():
    raise RuntimeError(f"Dataset not found at {DATA_PATH}. Place health_lifestyle_dataset.csv in the repo root.")

MODEL, SCALER, FEATURE_NAMES, METRICS, LABEL_ENCODERS = train_models()


@app.get("/health")
def health():
    return {"status": "ok", "model_trained": True}


@app.post("/predict")
def predict(req: PredictRequest):
    try:
        # Map gender to 0/1 same as original app
        gender_val = 1 if req.gender.lower() == 'male' else 0
        input_dict = {
            'age': req.age,
            'gender': gender_val,
            'bmi': req.bmi,
            'daily_steps': req.daily_steps,
            'sleep_hours': req.sleep_hours,
            'water_intake_l': req.water_intake_l,
            'calories_consumed': req.calories_consumed,
            'smoker': req.smoker,
            'alcohol': req.alcohol,
            'resting_hr': req.resting_hr,
            'systolic_bp': req.systolic_bp,
            'diastolic_bp': req.diastolic_bp,
            'cholesterol': req.cholesterol,
            'family_history': req.family_history
        }
        row = [input_dict.get(col, 0) for col in FEATURE_NAMES]
        input_df = pd.DataFrame([row], columns=FEATURE_NAMES)

        num_cols = [c for c in FEATURE_NAMES if c in SCALER.feature_names_in_]
        input_df[num_cols] = SCALER.transform(input_df[num_cols])

        pred = MODEL.predict(input_df)[0]
        final_res = "High Risk" if int(pred) == 1 else "Low Risk"
        prob_high = None
        if hasattr(MODEL, 'predict_proba'):
            probs = MODEL.predict_proba(input_df)[0]
            # assume class order [0,1]
            if len(probs) > 1:
                prob_high = float(probs[1])
            else:
                prob_high = float(probs[0])

        return {
            "result": final_res,
            "prediction": int(pred),
            "probability": prob_high,
            "model": "RandomForest",
            "metrics": {"f1_high_risk": METRICS[1], "acc": METRICS[0]}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feature_importance")
def feature_importance(n: int = 10):
    """Return top-n feature importances from the trained RandomForest model."""
    try:
        if not hasattr(MODEL, 'feature_importances_'):
            raise HTTPException(status_code=400, detail='Model has no feature_importances_')
        importances = list(MODEL.feature_importances_)
        features = FEATURE_NAMES
        pairs = sorted(zip(features, importances), key=lambda x: x[1], reverse=True)
        top = pairs[:n]
        return {"top_features": [{"feature": f, "importance": float(imp)} for f, imp in top]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
