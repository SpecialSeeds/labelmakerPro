const firebaseConfig = {
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
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

const patientDB = new PatientDatabase();