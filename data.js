// mock insurance plans
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

// patient database stored in localStorage
class PatientDatabase {
    constructor() {
        this.storageKey = 'pharmacyPatients';
        this.rxCounterKey = 'rxCounter';
        this.crxCounterKey = 'crxCounter';
        this.initializeCounters();
    }

    initializeCounters() {
        if (!localStorage.getItem(this.rxCounterKey)) {
            localStorage.setItem(this.rxCounterKey, '1000000');
        }
        if (!localStorage.getItem(this.crxCounterKey)) {
            localStorage.setItem(this.crxCounterKey, '5000000');
        }
    }

    getNextRxNumber() {
        let current = parseInt(localStorage.getItem(this.rxCounterKey));
        localStorage.setItem(this.rxCounterKey, (current + 1).toString());
        return current.toString();
    }

    getNextCrxNumber() {
        let current = parseInt(localStorage.getItem(this.crxCounterKey));
        localStorage.setItem(this.crxCounterKey, (current + 1).toString());
        return 'C' + current.toString();
    }

    getAllPatients() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    savePatients(patients) {
        localStorage.setItem(this.storageKey, JSON.stringify(patients));
    }

    addPatient(patient) {
        const patients = this.getAllPatients();
        patient.id = Date.now().toString();
        patients.push(patient);
        this.savePatients(patients);
        return patient;
    }

    findPatientByDOB(dob) {
        const patients = this.getAllPatients();
        return patients.filter(p => p.dateOfBirth === dob);
    }

    getPatientById(id) {
        const patients = this.getAllPatients();
        return patients.find(p => p.id === id);
    }
}

const patientDB = new PatientDatabase();