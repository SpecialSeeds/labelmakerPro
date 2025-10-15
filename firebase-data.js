const firebaseConfig = {
  apiKey: "REPLACE_API_KEY",
  authDomain: "REPLACE_AUTH_DOMAIN",
  projectId: "REPLACE_PROJECT_ID",
  storageBucket: "REPLACE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
  appId: "REPLACE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const insurancePlans = [
    { name: "Blue Cross Blue Shield", bin: "003858", pcn: "A4" },
    { name: "CVS Caremark", bin: "610020", pcn: "CLAIM" },
    { name: "Express Scripts", bin: "003858", pcn: "CN" },
    { name: "OptumRx", bin: "610080", pcn: "OPTUM" },
    { name: "Aetna", bin: "610455", pcn: "CVS" },
    { name: "UnitedHealthcare", bin: "610020", pcn: "UNET" },
    { name: "Humana", bin: "610014", pcn: "HUM" },
    { name: "Cigna", bin: "610014", pcn: "CIGNA" },
    { name: "Medicare Part D", bin: "610455", pcn: "MED" },
    { name: "Medicaid", bin: "123456", pcn: "MCAID" }
];

class PatientDatabase {
    constructor() {
        this.patientsRef = db.collection('patients');
        this.countersRef = db.collection('counters').doc('rx_counters');
        this.initializeCounters();
    }

    async initializeCounters() {
        try {
            const doc = await this.countersRef.get();
            if (!doc.exists) {
                await this.countersRef.set({
                    rxCounter: 1000000,
                    crxCounter: 5000000
                });
                console.log('counters initialized');
            }
        } catch (error) {
            console.error('error initializing counters:', error);
        }
    }

    async getNextRxNumber() {
        try {
            const newCounter = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(this.countersRef);
                if (!doc.exists) {
                    throw new Error('counters document does not exist');
                }
                const current = doc.data().rxCounter;
                transaction.update(this.countersRef, { rxCounter: current + 1 });
                return current;
            });
            return newCounter.toString();
        } catch (error) {
            console.error('error getting rx number:', error);
            throw error;
        }
    }

    async getNextCrxNumber() {
        try {
            const newCounter = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(this.countersRef);
                if (!doc.exists) {
                    throw new Error('counters document does not exist');
                }
                const current = doc.data().crxCounter;
                transaction.update(this.countersRef, { crxCounter: current + 1 });
                return current;
            });
            return 'C' + newCounter.toString();
        } catch (error) {
            console.error('error getting crx number:', error);
            throw error;
        }
    }

    async getAllPatients() {
        try {
            const snapshot = await this.patientsRef.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('error getting patients:', error);
            return [];
        }
    }

    async addPatient(patient) {
        try {
            const docRef = await this.patientsRef.add(patient);
            return { id: docRef.id, ...patient };
        } catch (error) {
            console.error('error adding patient:', error);
            throw error;
        }
    }

    async findPatientByDOB(dob) {
        try {
            const snapshot = await this.patientsRef.where('dateOfBirth', '==', dob).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('error finding patient:', error);
            return [];
        }
    }

    async getPatientById(id) {
        try {
            const doc = await this.patientsRef.doc(id).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('error getting patient by id:', error);
            return null;
        }
    }
}

// Settings management
class SettingsManager {
    constructor() {
        this.settingsRef = db.collection('settings').doc('app_settings');
        this.defaultPassword = 'password';
    }

    async getSettings() {
        try {
            const doc = await this.settingsRef.get();
            if (doc.exists) {
                return doc.data();
            } else {
                const defaultSettings = {
                    password: this.defaultPassword,
                    pharmacyName: 'Chantilly Academy Pharmacy',
                    pharmacyAddress: '4201 Stringfellow Rd, Chantilly, VA 20151',
                    pharmacyPhone: '(703) 222-2228',
                    updatedAt: new Date().toISOString()
                };
                await this.settingsRef.set(defaultSettings);
                return defaultSettings;
            }
        } catch (error) {
            console.error('error getting settings:', error);
            return { 
                password: this.defaultPassword,
                pharmacyName: 'Chantilly Academy Pharmacy',
                pharmacyAddress: '4201 Stringfellow Rd, Chantilly, VA 20151',
                pharmacyPhone: '(703) 222-2228'
            };
        }
    }

    async updateSettings(settings) {
        try {
            await this.settingsRef.update({
                ...settings,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('error updating settings:', error);
            throw error;
        }
    }

    async verifyPassword(inputPassword) {
        const settings = await this.getSettings();
        return inputPassword === settings.password;
    }
}

settingsManager = new SettingsManager();
patientDB = new PatientDatabase();