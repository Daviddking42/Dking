import csv
import random
import math

def generate_patient_data(num_records=1500):
    headers = [
        "Patient_ID", "Fever", "Chills", "Headache", "Nausea", 
        "Fatigue", "Anemia", "Temperature", "Malaria"
    ]
    
    records = []
    
    # Set seed for reproducibility
    random.seed(42)
    
    for i in range(1, num_records + 1):
        patient_id = f"PAT_{i:04d}"
        
        # Determine malaria status (around 45% positive rate)
        is_malaria = 1 if random.random() < 0.45 else 0
        
        # Symptoms and temperature distributions based on malaria status
        if is_malaria:
            # Malaria positive patient profiles: high frequency of symptoms and elevated temperature
            fever = "Yes" if random.random() < 0.92 else "No"
            chills = "Yes" if random.random() < 0.88 else "No"
            headache = "Yes" if random.random() < 0.78 else "No"
            nausea = "Yes" if random.random() < 0.62 else "No"
            fatigue = "Yes" if random.random() < 0.85 else "No"
            anemia = "Yes" if random.random() < 0.48 else "No"
            
            # Temperature: normally distributed around 39.3 C, sd = 0.8
            # Box-Muller transform for normal distribution
            u1 = random.random()
            u2 = random.random()
            z0 = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
            temperature = round(39.3 + z0 * 0.8, 1)
            # Clip temperature to realistic high bounds
            temperature = max(37.5, min(41.8, temperature))
        else:
            # Malaria negative patient profiles (healthy, colds, other flus)
            fever = "Yes" if random.random() < 0.35 else "No"
            chills = "Yes" if random.random() < 0.25 else "No"
            headache = "Yes" if random.random() < 0.40 else "No"
            nausea = "Yes" if random.random() < 0.15 else "No"
            fatigue = "Yes" if random.random() < 0.45 else "No"
            anemia = "Yes" if random.random() < 0.12 else "No"
            
            # Temperature: normally distributed around 37.0 C, sd = 0.6
            u1 = random.random()
            u2 = random.random()
            z0 = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
            temperature = round(37.0 + z0 * 0.6, 1)
            # Clip temperature to realistic bounds
            temperature = max(35.5, min(39.5, temperature))
            
        # Introduce missing values for preprocessing practice (as requested in Step 02)
        # Fever: ~5% missing
        if random.random() < 0.05:
            fever = ""  # Missing value represented as empty string
            
        # Chills: ~3% missing
        if random.random() < 0.03:
            chills = ""
            
        # Temperature: ~8% missing
        if random.random() < 0.08:
            temperature = ""  # Missing temperature
            
        records.append([
            patient_id, fever, chills, headache, nausea, 
            fatigue, anemia, temperature, is_malaria
        ])
        
    return headers, records

def main():
    filename = "malaria_symptoms_dataset.csv"
    headers, records = generate_patient_data()
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(records)
        
    print(f"Dataset successfully created and saved to {filename}")
    print(f"Total records: {len(records)}")
    
    # Calculate some brief stats
    malaria_pos = sum(1 for r in records if r[-1] == 1)
    print(f"Malaria Positive Cases: {malaria_pos} ({malaria_pos/len(records)*100:.1f}%)")
    print(f"Malaria Negative Cases: {len(records) - malaria_pos} ({(len(records) - malaria_pos)/len(records)*100:.1f}%)")

if __name__ == "__main__":
    main()
