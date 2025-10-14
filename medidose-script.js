function generateLotNumber() {
    const letters = Array.from({length: 3}, () => 
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join('');
    const numbers = Array.from({length: 2}, () => 
        Math.floor(Math.random() * 10)
    ).join('');
    const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + 
                   Math.floor(Math.random() * 10);
    return letters + numbers + suffix;
}

function drawControlledIcon(doc, x, y, schedule) {
    const iconSize = 14.4;
    const roman = {2: "II", 3: "III", 4: "IV", 5: "V"};
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.circle(x, y, iconSize / 2, 'S');
    
    doc.setFontSize(5);
    doc.setFont('times', 'bold');
    doc.text(`C${roman[schedule]}`, x, y + 1.5, {align: 'center'});
}

async function generateBarcode(text) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, text.replace(/-/g, '').replace(/ /g, ''), {
            format: "CODE128",
            width: 1,
            height: 40,
            displayValue: false,
            margin: 0
        });
        resolve(canvas.toDataURL());
    });
}

function getFontSizeByLength(text) {
    const length = text.length;
    if (length > 32) {
        return 3.5;
    } else if (length > 28) {
        return 4;
    } else if (length > 24) {
        return 4.5;
    } else if (length > 20) {
        return 5.5;
    } else if (length > 16) {
        return 6.5;
    } else {
        return 8;
    }
}

function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength);
    }
    return text;
}

async function generatePDF(formData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
    });

    const pkgDate = new Date();
    const expDate = new Date(pkgDate);
    expDate.setFullYear(expDate.getFullYear() + 5);
    
    const pkgDateStr = pkgDate.toLocaleDateString('en-US');
    const expDateStr = expDate.toLocaleDateString('en-US');
    const lotNumber = generateLotNumber();

    const labelSize = 85.68;
    const startX = 64.8;
    const startY = 75.6;
    const rows = 5;
    const cols = 5;

    const brandName = truncateText(formData.brandName, 35);
    const genericName = truncateText(formData.genericName, 35);

    const barcodeImg = await generateBarcode(formData.ndc);

    doc.setDrawColor(0);
    doc.setLineWidth(1);
    
    for (let i = 0; i <= rows; i++) {
        const y = startY + (i * labelSize);
        doc.line(startX, y, startX + (cols * labelSize), y);
    }
    
    for (let i = 0; i <= cols; i++) {
        const x = startX + (i * labelSize);
        doc.line(x, startY, x, startY + (rows * labelSize));
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = startX + (col * labelSize);
            const y = startY + (row * labelSize);
            const leftMargin = x + 3.6;
            let currentY = y + 8;

            if (formData.controlled) {
                const iconX = x + labelSize - 10.8;
                const iconY = y + 10.8;
                drawControlledIcon(doc, iconX, iconY, parseInt(formData.controlled));
            }

            doc.setFont('helvetica', 'bold');
            const brandFontSize = getFontSizeByLength(brandName);
            doc.setFontSize(brandFontSize);
            doc.text(brandName, leftMargin, currentY);
            currentY += 7.2;

            doc.setFont('helvetica', 'normal');
            const genericFontSize = getFontSizeByLength(genericName);
            doc.setFontSize(genericFontSize);
            doc.text(genericName, leftMargin, currentY);
            currentY += 7.2;

            doc.setFontSize(8);
            doc.text(formData.strength, leftMargin, currentY);
            currentY += 7.2;

            doc.text(lotNumber, leftMargin, currentY);
            currentY += 7.9;

            const barcodeWidth = 60;
            const barcodeHeight = 12.96;
            const centerX = x + labelSize / 2;
            doc.addImage(barcodeImg, 'PNG', centerX - barcodeWidth / 2, currentY, barcodeWidth, barcodeHeight);
            currentY += barcodeHeight + 4;

            doc.setFontSize(6);
            doc.text(formData.ndc, centerX, currentY, {align: 'center'});
            currentY += 6.5;

            doc.setFontSize(8);
            doc.text(formData.form, leftMargin, currentY);
            currentY += 7.9;

            const ovalWidth = 72;
            const ovalHeight = 10.08;
            doc.setLineWidth(1.2);
            doc.ellipse(centerX, currentY, ovalWidth / 2, ovalHeight / 2, 'S');
            doc.text(`Exp: ${expDateStr}`, centerX, currentY + 2, {align: 'center'});

            const pkgY = y + labelSize - 5;
            doc.setFontSize(4);
            doc.text(`Pkg: ${pkgDateStr} by ${formData.username}`, leftMargin, pkgY);
        }
    }

    const filename = `${formData.brandName.replace(/ /g, '_')}_${formData.strength.replace(/ /g, '_')}.pdf`;
    doc.save(filename);
}

document.getElementById('labelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        brandName: document.getElementById('brandName').value,
        genericName: document.getElementById('genericName').value,
        ndc: document.getElementById('ndc').value,
        strength: document.getElementById('strength').value,
        form: document.getElementById('form').value,
        username: document.getElementById('username').value,
        controlled: document.getElementById('controlled').value
    };

    const btn = e.target.querySelector('button');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        await generatePDF(formData);
        btn.textContent = '✓ PDF Generated!';
        setTimeout(() => {
            btn.textContent = 'create medidose label';
            btn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Error generating PDF:', error);
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
    }
});