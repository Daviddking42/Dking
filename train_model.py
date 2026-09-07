import pandas as pd
import numpy as np
import json
import os
from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc
)

def serialize_tree(tree, feature_names, node_id=0):
    """Recursively serializes a decision tree into a dictionary structure."""
    if tree.children_left[node_id] == -1:  # Leaf node
        val = tree.value[node_id][0]
        total = sum(val)
        prob_malaria = float(val[1] / total) if total > 0 else 0.0
        return {
            "type": "leaf",
            "probability": prob_malaria,
            "prediction": 1 if prob_malaria >= 0.5 else 0,
            "samples": int(total)
        }
    else:
        return {
            "type": "split",
            "feature_idx": int(tree.feature[node_id]),
            "feature_name": feature_names[tree.feature[node_id]],
            "threshold": float(tree.threshold[node_id]),
            "left": serialize_tree(tree, feature_names, tree.children_left[node_id]),
            "right": serialize_tree(tree, feature_names, tree.children_right[node_id])
        }

def main():
    dataset_path = "malaria_symptoms_dataset.csv"
    if not os.path.exists(dataset_path):
        print(f"Error: {dataset_path} not found. Please run generate_dataset.py first.")
        return

    print("Loading dataset...")
    df = pd.read_csv(dataset_path)

    # 1. Handle Missing Values (Step 02)
    print("Handling missing values...")
    symptom_cols = ["Fever", "Chills", "Headache", "Nausea", "Fatigue", "Anemia"]
    
    # Impute missing categorical symptoms with mode (most common value)
    imputation_modes = {}
    for col in symptom_cols:
        mode_val = df[col].mode()[0] if not df[col].mode().empty else "No"
        imputation_modes[col] = mode_val
        df[col] = df[col].fillna(mode_val)
        # Handle cases where value is empty string or whitespace
        df[col] = df[col].replace(r'^\s*$', mode_val, regex=True)

    # Impute missing temperature with average (mean)
    mean_temp = float(df["Temperature"].mean())
    df["Temperature"] = df["Temperature"].fillna(mean_temp)
    print(f"Imputed missing temperatures with mean: {mean_temp:.2f}°C")

    # 2. Convert Categorical Data (Yes/No -> 1/0)
    print("Converting categorical data to binary...")
    for col in symptom_cols:
        df[col] = df[col].astype(str).str.strip().str.capitalize()
        df[col] = df[col].map({"Yes": 1, "No": 0}).fillna(0).astype(int)

    # 3. Normalize Temperature Values (Step 02)
    # Save min and max for client-side scaling reproduction
    min_temp = float(df["Temperature"].min())
    max_temp = float(df["Temperature"].max())
    print(f"Temperature bounds - Min: {min_temp}°C, Max: {max_temp}°C")
    
    df["Temperature_Normalized"] = (df["Temperature"] - min_temp) / (max_temp - min_temp)

    # 4. Split Data into Train, Validation, and Test (Step 02)
    features = symptom_cols + ["Temperature_Normalized"]
    X = df[features]
    y = df["Malaria"]

    # 70% Train, 30% Temporary (Validation + Test)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    # 15% Validation, 15% Test
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    print(f"Data split sizes: Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # 5. Prevent Overfitting & Model Selection (Step 03 & 05)
    # We will train three classifiers: Logistic Regression, Decision Tree, Random Forest
    kf = KFold(n_splits=5, shuffle=True, random_state=42)

    # A. Logistic Regression (with L2 Regularization)
    lr_model = LogisticRegression(penalty='l2', C=1.0, random_state=42)
    lr_cv_scores = cross_val_score(lr_model, X_train, y_train, cv=kf, scoring='accuracy')
    lr_model.fit(X_train, y_train)
    
    # B. Decision Tree (Limit complexity with max_depth=3)
    dt_model = DecisionTreeClassifier(max_depth=3, random_state=42)
    dt_cv_scores = cross_val_score(dt_model, X_train, y_train, cv=kf, scoring='accuracy')
    dt_model.fit(X_train, y_train)

    # C. Random Forest (Regularization: estimators=50, max_depth=4)
    rf_model = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
    rf_cv_scores = cross_val_score(rf_model, X_train, y_train, cv=kf, scoring='accuracy')
    rf_model.fit(X_train, y_train)

    print(f"Logistic Regression 5-Fold CV Accuracy: {lr_cv_scores.mean():.4f} (+/- {lr_cv_scores.std():.4f})")
    print(f"Decision Tree 5-Fold CV Accuracy: {dt_cv_scores.mean():.4f} (+/- {dt_cv_scores.std():.4f})")
    print(f"Random Forest 5-Fold CV Accuracy: {rf_cv_scores.mean():.4f} (+/- {rf_cv_scores.std():.4f})")

    # 6. Evaluate Performance (Step 06)
    models = {
        "Logistic Regression": lr_model,
        "Decision Tree": dt_model,
        "Random Forest": rf_model
    }

    results = {}
    
    for name, model in models.items():
        # Predictions
        y_train_pred = model.predict(X_train)
        y_val_pred = model.predict(X_val)
        y_test_pred = model.predict(X_test)
        
        y_test_prob = model.predict_proba(X_test)[:, 1]
        
        # Train vs Val Accuracy for overfitting checks
        train_acc = accuracy_score(y_train, y_train_pred)
        val_acc = accuracy_score(y_val, y_val_pred)
        test_acc = accuracy_score(y_test, y_test_pred)
        
        # Metrics on Test Set
        precision = precision_score(y_test, y_test_pred)
        recall = recall_score(y_test, y_test_pred)
        f1 = f1_score(y_test, y_test_pred)
        
        # Confusion Matrix
        tn, fp, fn, tp = confusion_matrix(y_test, y_test_pred).ravel()
        
        # ROC Curve
        fpr, tpr, thresholds = roc_curve(y_test, y_test_prob)
        roc_auc = auc(fpr, tpr)
        
        # Feature Importance / Coefficients
        if name == "Logistic Regression":
            importance = lr_model.coef_[0].tolist()
        else:
            importance = model.feature_importances_.tolist()
            
        results[name] = {
            "train_accuracy": float(train_acc),
            "val_accuracy": float(val_acc),
            "test_accuracy": float(test_acc),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "confusion_matrix": {
                "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
            },
            "roc_curve": {
                "fpr": fpr.tolist(),
                "tpr": tpr.tolist(),
                "thresholds": thresholds.tolist(),
                "auc": float(roc_auc)
            },
            "feature_importance": dict(zip(features, importance))
        }
        
        print(f"\n--- {name} Results ---")
        print(f"Train Acc: {train_acc:.4f} | Val Acc: {val_acc:.4f} | Test Acc: {test_acc:.4f}")
        print(f"Test Precision: {precision:.4f} | Recall: {recall:.4f} | F1: {f1:.4f}")

    # Serialize models parameters for JS implementation
    serialized_lr = {
        "coefficients": dict(zip(features, lr_model.coef_[0].tolist())),
        "intercept": float(lr_model.intercept_[0])
    }
    
    serialized_dt = serialize_tree(dt_model.tree_, features)
    
    serialized_rf = []
    for estimator in rf_model.estimators_:
        serialized_rf.append(serialize_tree(estimator.tree_, features))

    # Export structure
    metadata = {
        "imputation": {
            "modes": imputation_modes,
            "mean_temp": mean_temp
        },
        "normalization": {
            "min_temp": min_temp,
            "max_temp": max_temp
        },
        "features": features,
        "model_performance": results,
        "models": {
            "Logistic_Regression": serialized_lr,
            "Decision_Tree": serialized_dt,
            "Random_Forest": serialized_rf
        }
    }
    
    # Save to web_app folder
    os.makedirs("web_app", exist_ok=True)
    with open("web_app/model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    print("\nSaved model_metadata.json to web_app/")

if __name__ == "__main__":
    main()
