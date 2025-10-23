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
        pharmacyName: 'Chantilly Academy Pharmacy',
        pharmacyAddress: '4201 Stringfellow Rd, Greenbriar, VA 20151',
        pharmacyPhone: '(420) 102 0151'
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

    console.log('Searching for DOB:', dob); // Debug log

    try {
        const matches = await patientDB.findPatientByDOB(dob);
        console.log('Found matches:', matches.length); // Debug log
        
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
            console.log('Patient DOB:', patient.dateOfBirth); // Debug log
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

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Generate Dymo label XML format
function generateDymoLabelXML(data, barcodeText) {
    const rxLabel = data.isControlled ? 'CRX#:' : 'RX#:';
    
    // Format the prescription text content with proper line breaks and styling
    const pharmacyInfo = `${data.pharmacyName}
${data.pharmacyAddress}
${data.pharmacyPhone}`;

    const patientInfo = `Patient: ${data.patient.firstName} ${data.patient.lastName}
DOB: ${data.patient.dateOfBirth}
Address: ${data.patient.address}
Phone: ${data.patient.phone}`;

    const drugInfo = `${data.drugName}
${rxLabel} ${data.rxNumber}`;

    const directions = `Directions: ${data.directions}`;

    const additionalInfo = `Mfr: ${data.manufacturer}
NDC: ${data.ndc}
Prescriber: ${data.prescriber}
QTY: ${data.quantity}  Days Supply: ${data.daysSupply}  Refills: ${data.refills}
Allergies: ${data.patient.allergies}
Filled: ${data.date}`;

    return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
    <PaperOrientation>Landscape</PaperOrientation>
    <Id>RxLabel</Id>
    <IsOutlined>false</IsOutlined>
    <PaperName>30252 Address</PaperName>
    <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="5760" Height="3240" Rx="270" Ry="270" />
    </DrawCommands>
    <ObjectInfo>
        <TextObject>
            <n>PharmacyHeader</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${escapeXml(pharmacyInfo)}</String>
                    <Attributes>
                        <Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="144" Y="144" Width="5472" Height="432" />
    </ObjectInfo>
    <ObjectInfo>
        <TextObject>
            <n>PatientInfo</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${escapeXml(patientInfo)}</String>
                    <Attributes>
                        <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="144" Y="576" Width="3600" Height="432" />
    </ObjectInfo>
    <ObjectInfo>
        <TextObject>
            <n>DrugInfo</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${escapeXml(drugInfo)}</String>
                    <Attributes>
                        <Font Family="Arial" Size="12" Bold="True" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="144" Y="1008" Width="3600" Height="432" />
    </ObjectInfo>
    <ObjectInfo>
        <TextObject>
            <n>Directions</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${escapeXml(directions)}</String>
                    <Attributes>
                        <Font Family="Arial" Size="10" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="144" Y="1440" Width="3600" Height="432" />
    </ObjectInfo>
    <ObjectInfo>
        <TextObject>
            <n>AdditionalInfo</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">${escapeXml(additionalInfo)}</String>
                    <Attributes>
                        <Font Family="Arial" Size="7" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="144" Y="1872" Width="3600" Height="1224" />
    </ObjectInfo>
    <ObjectInfo>
        <BarcodeObject>
            <n>RxBarcode</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <Text>${escapeXml(barcodeText)}</Text>
            <Type>Code128Auto</Type>
            <ShowText>True</ShowText>
            <CheckSum>False</CheckSum>
            <TextPosition>Bottom</TextPosition>
            <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <TextColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
            <CheckSumColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
            <BarHeight>576</BarHeight>
            <BarWidth>2</BarWidth>
        </BarcodeObject>
        <Bounds X="3888" Y="1440" Width="1584" Height="720" />
    </ObjectInfo>
</DieCutLabel>`;
}

// initialize Dymo Label Framework
let dymoLabelFramework = null;

async function initializeDymo() {
    try {
        if (typeof dymo !== 'undefined') {
            dymoLabelFramework = dymo.label.framework;
            console.log('Dymo Label Framework initialized');
            return true;
        } else {
            console.warn('Dymo Label Framework not found - will fallback to download');
            return false;
        }
    } catch (error) {
        console.error('Error initializing Dymo:', error);
        return false;
    }
}

async function getDymoPrinters() {
    try {
        if (!dymoLabelFramework) return [];
        const printers = dymoLabelFramework.getPrinters();
        return printers.filter(printer => printer.printerType === "LabelWriterPrinter");
    } catch (error) {
        console.error('Error getting Dymo printers:', error);
        return [];
    }
}

async function generateRxLabel(data, numLabels, debugMode) {
    const barcodeText = data.rxNumber.replace(/-/g, '');
    
    // Create the label XML content
    const labelXML = generateDymoLabelXML(data, barcodeText);
    
    // Try to print directly with Dymo, otherwise download
    if (debugMode) {
        // Debug mode - download the file
        downloadLabelFile(labelXML, `rxlabel_${data.rxNumber}_${data.patient.lastName}.label`);
    } else {
        // Try to print directly
        const printSuccess = await printWithDymo(labelXML, numLabels);
        if (!printSuccess) {
            // Fallback to download if printing fails
            console.log('Printing failed, downloading label file instead');
            downloadLabelFile(labelXML, `rxlabel_${data.rxNumber}_${data.patient.lastName}.label`);
        }
    }
}


async function printWithDymo(labelXML, numLabels) {
    try {
        if (!dymoLabelFramework) {
            const initialized = await initializeDymo();
            if (!initialized) return false;
        }

        // Get available printers
        const printers = await getDymoPrinters();
        if (printers.length === 0) {
            alert('No Dymo printers found. Please ensure your Dymo printer is connected and the Dymo Label software is running.');
            return false;
        }

        // Use the first available printer
        const printerName = printers[0].name;
        console.log(`Printing to: ${printerName}`);

        // Print the specified number of labels
        for (let i = 0; i < numLabels; i++) {
            dymoLabelFramework.printLabel(printerName, '', labelXML, '');
        }

        console.log(`Successfully printed ${numLabels} labels to ${printerName}`);
        return true;

    } catch (error) {
        console.error('Error printing with Dymo:', error);
        alert('Error printing labels: ' + error.message);
        return false;
    }
}

function downloadLabelFile(labelXML, filename) {
    const blob = new Blob([labelXML], { type: 'text/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function resetForm() {
    selectedPatient = null;
    document.getElementById('prescriptionSection').style.display = 'none';
    document.getElementById('patientLookup').style.display = 'block';
    document.getElementById('patientDOB').value = '';
    document.getElementById('patientResults').style.display = 'none';
    document.getElementById('prescriptionForm').reset();
}