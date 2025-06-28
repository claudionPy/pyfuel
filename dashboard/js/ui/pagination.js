/**
 * Pagination renders and updates pagination controls for different dashboard sections.
 * It handles generating page buttons with ellipsis and next/previous navigation.
 */
export class Pagination {
    /**
     * Replace the pagination controls HTML for a given section.
     * @param {string} section - One of 'dispenses', 'vehicles', 'drivers'.
     */
    static updatePaginationControls(section) {
        // Retrieve current pagination state
        const { currentPage, pageSize, totalItems } = Dashboard.pagination[section];
        const totalPages = Math.ceil(totalItems / pageSize);
        const controlsContainer = document.querySelector(`#${section} .pagination-controls`);

        // Render Previous button, page numbers, Next button, and status text
        controlsContainer.innerHTML = `
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary ${currentPage <= 1 ? 'disabled' : ''}" 
                    onclick="${this.getModuleName(section)}.load${this.capitalize(section)}(${currentPage - 1})">
                    <i class="bi bi-chevron-left"></i>
                </button>
                
                ${this.generatePageNumbers(section, currentPage, totalPages)}
                
                <button class="btn btn-sm btn-outline-primary ${currentPage >= totalPages ? 'disabled' : ''}" 
                    onclick="${this.getModuleName(section)}.load${this.capitalize(section)}(${currentPage + 1})">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <span class="ms-2">Pagina ${currentPage} di ${totalPages}</span>
        `;
    }

    /**
     * Generate HTML for page number buttons, with ellipsis when needed.
     * @param {string} section
     * @param {number} currentPage
     * @param {number} totalPages
     * @returns {string} HTML string of page buttons and ellipses.
     */
    static generatePageNumbers(section, currentPage, totalPages) {
        let pagesHtml = '';
        const maxVisiblePages = 5;

        // If few pages, show all
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pagesHtml += this.getPageButton(section, i, currentPage);
            }
        } else {
            // Show first/last and surrounding pages with ellipsis
            if (currentPage <= 3) {
                // Beginning range
                for (let i = 1; i <= 3; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            } else if (currentPage >= totalPages - 2) {
                // Ending range
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = totalPages - 2; i <= totalPages; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
            } else {
                // Middle range
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            }
        }

        return pagesHtml;
    }

    /**
     * Create HTML for an individual page button.
     * @param {string} section
     * @param {number} page - Page number to render.
     * @param {number} currentPage
     * @returns {string} Button HTML for the page.
     */
    static getPageButton(section, page, currentPage) {
        const moduleName = this.getModuleName(section);
        // Highlight current page button
        const activeClass = page === currentPage ? 'btn-primary' : 'btn-outline-primary';

        return `
            <button class="btn btn-sm ${activeClass}" 
                onclick="${moduleName}.load${this.capitalize(section)}(${page})">
                ${page}
            </button>
        `;
    }

    /**
     * Determine which module to call based on section.
     * @param {string} section
     * @returns {string} Module class name.
     */
    static getModuleName(section) {
        const map = { dispenses: 'DispensesModule', vehicles: 'VehiclesModule', drivers: 'DriversModule' };
        return map[section] || 'DispensesModule';
    }

    /**
     * Capitalize the first letter of a string.
     * @param {string} str
     * @returns {string}
     */
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

