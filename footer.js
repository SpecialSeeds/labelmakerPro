const footerLinks = [
    { name: 'GitHub', url: 'https://github.com/specialseeds', icon: '🌐' },
    { name: 'Website', url: 'https://chantillyacademy.fcps.edu/academics/pharmacy-technician', icon: '🔗' }
];

async function loadFooter() {
    try {
        const settings = await settingsManager.getSettings();
        const currentYear = new Date().getFullYear();
        
        const footerHTML = `
            <footer class="site-footer">
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>pharmacy information</h3>
                        <p><strong>${settings.pharmacyName || 'Chantilly Academy Pharmacy'}</strong></p>
                        <p>${settings.pharmacyAddress || '4201 Stringfellow Rd, Chantilly, VA 20151'}</p>
                        <p>phone: ${settings.pharmacyPhone || '(703) 222-2228'}</p>
                    </div>
                    
                    <div class="footer-section">
                        <h3>links</h3>
                        <div class="footer-links">
                            ${footerLinks.map(link => `
                                <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="footer-link">
                                    <span class="link-icon">${link.icon}</span>
                                    <span>${link.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="footer-section">
                        <h3>credits</h3>
                        <p>developed by specialseeds</p>
                        <p>built with firebase & vanilla javascript</p>
                        <p class="footer-copyright">© ${currentYear} ${settings.pharmacyName || 'Chantilly Academy Pharmacy'}. all rights reserved.</p>
                    </div>
                </div>
            </footer>
        `;
        
        document.body.insertAdjacentHTML('beforeend', footerHTML);
        console.log('Footer loaded successfully');
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

// Load footer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFooter);
} else {
    loadFooter();
}