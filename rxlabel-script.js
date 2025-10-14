let selectedPatient = null;

window.addEventListener('DOMContentLoaded', () => {
    const insuranceSelect = document.getElementById('insurancePlan');
    insurancePlans.forEach(plan => {
        const option = document.createElement('option');
        option.value = JSON.stringify(plan);
        option.textContent = `${plan.name} (BIN: ${plan.bin})`;
        insuranceSelect.appendChild(option);
    });
});

function getSettings() {
    const defaults = {
        pharmacyName: 'UVA Health Pharmacy',
        pharmacyAddress: '1215 Lee St, Charlottesville, VA 22903',
        pharmacyPhone: '(434) 924-0000'
    };
    
    const saved = localStorage.getItem('pharmacySettings');
    return saved ? JSON.parse(saved) : defaults;
}

function toggleDEARequired() {
    const isControlled = document.getElementById('isControlled').checked;
    const deaInput = document.getElementById('prescriberDEA');
    deaInput.required = isControlled;
}

async function searchPatient() {
    const dob = document.getElementById('patientDOB').value;
    if (!dob) {
        alert('please enter a date of birth');
        return;
    }

    try {
        const matches = await patientDB.findPatientByDOB(dob);
        const resultsDiv = document.getElementById('patientResults');
        const selectElement = document.getElementById('patientSelect');

        selectElement.innerHTML = '';

        if (matches.length === 0) {
            alert('no patients found with that date of birth');
            showAddPatient();
            document.getElementById('newPatientDOB').value = dob;
            return;
        }

        matches.forEach(patient => {
            const option = document.createElement('option');
            option.value = patient.id;
            option.textContent = `${patient.firstName} ${patient.lastName} - ${patient.address}`;
            selectElement.appendChild(option);
        });

        resultsDiv.style.display = 'block';
    } catch (error) {
        console.error('error searching patient:', error);
        alert('error searching for patient');
    }
}

async function selectPatient() {
    const selectElement = document.getElementById('patientSelect');
    const patientId = selectElement.value;

    if (!patientId) {
        alert('please select a patient');
        return;
    }

    try {
        selectedPatient = await patientDB.getPatientById(patientId);
        showPrescriptionForm();
    } catch (error) {
        console.error('error selecting patient:', error);
        alert('error loading patient data');
    }
}

function showAddPatient() {
    document.getElementById('patientLookup').style.display = 'none';
    document.getElementById('addPatientSection').style.display = 'block';
}

function cancelAddPatient() {
    document.getElementById('addPatientSection').style.display = 'none';
    document.getElementById('patientLookup').style.display = 'block';
}

document.getElementById('addPatientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    console.log('form submitted');

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'adding patient...';
    btn.disabled = true;

    try {
        const insuranceData = document.getElementById('insurancePlan').value;
        let insurance = null;
        if (insuranceData) {
            insurance = {
                ...JSON.parse(insuranceData),
                memberId: document.getElementById('memberId').value
            };
        }

        const patient = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            dateOfBirth: document.getElementById('newPatientDOB').value,
            gender: document.getElementById('gender').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            weight: document.getElementById('weight').value,
            height: document.getElementById('height').value,
            allergies: document.getElementById('allergies').value || 'NKDA',
            insurance: insurance
        };

        console.log('patient data:', patient);

        selectedPatient = await patientDB.addPatient(patient);
        console.log('patient added:', selectedPatient);
        
        alert('patient added successfully');
        showPrescriptionForm();
    } catch (error) {
        console.error('error adding patient:', error);
        alert('error adding patient: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

function showPrescriptionForm() {
    document.getElementById('patientLookup').style.display = 'none';
    document.getElementById('addPatientSection').style.display = 'none';
    document.getElementById('prescriptionSection').style.display = 'block';

    const infoBox = document.getElementById('selectedPatientInfo');
    infoBox.innerHTML = `
        <h3>patient: ${selectedPatient.firstName} ${selectedPatient.lastName}</h3>
        <p><strong>dob:</strong> ${selectedPatient.dateOfBirth} | <strong>phone:</strong> ${selectedPatient.phone}</p>
        <p><strong>address:</strong> ${selectedPatient.address}</p>
        <p><strong>allergies:</strong> ${selectedPatient.allergies}</p>
    `;
}

async function generateBarcode(text) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, text.replace(/-/g, ''), {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 5
        });
        resolve(canvas.toDataURL());
    });
}

document.getElementById('prescriptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const isControlled = document.getElementById('isControlled').checked;
    
    if (isControlled && !document.getElementById('prescriberDEA').value) {
        alert('dea number is required for controlled substances');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'generating...';
    btn.disabled = true;

    try {
        const rxNumber = isControlled ? await patientDB.getNextCrxNumber() : await patientDB.getNextRxNumber();
        const numLabels = parseInt(document.getElementById('numLabels').value);
        const debugMode = document.getElementById('debugMode').checked;
        const settings = getSettings();

        const prescriberInfo = [];
        const prescriberName = document.getElementById('prescriberName').value;
        const prescriberNPI = document.getElementById('prescriberNPI').value;
        const prescriberDEA = document.getElementById('prescriberDEA').value;

        prescriberInfo.push(prescriberName);
        if (prescriberNPI) prescriberInfo.push(`NPI: ${prescriberNPI}`);
        if (prescriberDEA) prescriberInfo.push(`DEA: ${prescriberDEA}`);

        const prescriptionData = {
            patient: selectedPatient,
            drugName: document.getElementById('drugName').value,
            manufacturer: document.getElementById('manufacturer').value,
            ndc: document.getElementById('ndc').value,
            directions: document.getElementById('directions').value,
            quantity: document.getElementById('quantity').value,
            daysSupply: document.getElementById('daysSupply').value,
            refills: document.getElementById('refills').value,
            prescriber: prescriberInfo.join(' / '),
            pharmacyName: settings.pharmacyName,
            pharmacyAddress: settings.pharmacyAddress,
            pharmacyPhone: settings.pharmacyPhone,
            rxNumber: rxNumber,
            date: new Date().toLocaleDateString('en-US'),
            isControlled: isControlled
        };

        await generateRxLabel(prescriptionData, numLabels, debugMode);
        btn.textContent = 'labels generated';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('error generating labels:', error);
        alert('error generating labels: ' + error.message);
        btn.textContent = 'error - try again';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }
});

async function generateRxLabel(data, numLabels, debugMode) {
    const { jsPDF } = window.jspdf;
    
    const labelWidth = 4 * 72;
    const labelHeight = 2.25 * 72;
    
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [labelWidth, labelHeight]
    });

    const barcodeImg = await generateBarcode(data.rxNumber);

    for (let i = 0; i < numLabels; i++) {
        if (i > 0) {
            doc.addPage([labelWidth, labelHeight], 'landscape');
        }

        let currentY = 15;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(data.pharmacyName, labelWidth / 2, currentY, { align: 'center' });
        currentY += 10;
        doc.setFontSize(8);
        doc.text(data.pharmacyAddress, labelWidth / 2, currentY, { align: 'center' });
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Patient: ${data.patient.firstName} ${data.patient.lastName}`, 10, currentY);
        doc.text(`DOB: ${data.patient.dateOfBirth}`, labelWidth - 80, currentY);
        currentY += 12;

        doc.setFontSize(8);
        const addressText = doc.splitTextToSize(`Address: ${data.patient.address}`, labelWidth - 100);
        doc.text(addressText, 10, currentY);
        doc.text(`Phone: ${data.patient.phone}`, labelWidth - 80, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const drugText = doc.splitTextToSize(data.drugName, labelWidth - 90);
        doc.text(drugText, 10, currentY);
        
        const rxLabel = data.isControlled ? 'CRX#:' : 'RX#:';
        const rxText = `${rxLabel} ${data.rxNumber}`;
        const rxWidth = doc.getTextWidth(rxText);
        doc.text(rxText, labelWidth - rxWidth - 10, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const directions = doc.splitTextToSize(data.directions, labelWidth - 90);
        doc.text(directions, 10, currentY);
        
        const barcodeWidth = 70;
        const barcodeHeight = 25;
        const barcodeX = labelWidth - barcodeWidth - 10;
        const barcodeY = currentY - 5;
        doc.addImage(barcodeImg, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
        
        currentY += (directions.length * 10) + 10;

        doc.setFontSize(7);
        doc.text(`Mfr: ${data.manufacturer}`, 10, currentY);
        currentY += 10;
        
        doc.text(`NDC: ${data.ndc}`, 10, currentY);
        currentY += 10;

        doc.text(`Prescriber: ${data.prescriber}`, 10, currentY);
        
        doc.text(`QTY: ${data.quantity}`, labelWidth - 70, currentY - 20);
        doc.text(`Days: ${data.daysSupply}`, labelWidth - 70, currentY - 10);
        doc.text(`Refills: ${data.refills}`, labelWidth - 70, currentY);
        
        currentY += 10;
        doc.text(`Filled: ${data.date}`, 10, currentY);
    }

    if (debugMode) {
        doc.save(`rxlabel_${data.rxNumber}_${data.patient.lastName}.pdf`);
    } else {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    }
}

function resetForm() {
    selectedPatient = null;
    document.getElementById('prescriptionSection').style.display = 'none';
    document.getElementById('patientLookup').style.display = 'block';
    document.getElementById('patientDOB').value = '';
    document.getElementById('patientResults').style.display = 'none';
    document.getElementById('prescriptionForm').reset();
}