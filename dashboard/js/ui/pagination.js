export class Pagination {
    static updatePaginationControls(section) {
        const { currentPage, pageSize, totalItems } = Dashboard.pagination[section];
        const totalPages = Math.ceil(totalItems / pageSize);
        const controlsContainer = document.querySelector(`#${section} .pagination-controls`);

        controlsContainer.innerHTML = `
        <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary ${currentPage <= 1 ? 'disabled' : ''}" 
                onclick="DispensesModule.loadDispenses(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
            </button>
            
            ${this.generatePageNumbers(section, currentPage, totalPages)}
            
            <button class="btn btn-sm btn-outline-primary ${currentPage >= totalPages ? 'disabled' : ''}" 
                onclick="DispensesModule.loadDispenses(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <span class="ms-2">Pagina ${currentPage} di ${totalPages}</span>
    `;
    }

    static generatePageNumbers(section, currentPage, totalPages) {
        let pagesHtml = '';
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pagesHtml += this.getPageButton(section, i, currentPage);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 3; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            } else if (currentPage >= totalPages - 2) {
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = totalPages - 2; i <= totalPages; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
            } else {
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

    static getPageButton(section, page, currentPage) {
        const moduleMap = {
            dispenses: 'DispensesModule',
            vehicles: 'VehiclesModule',
            drivers: 'DriversModule'
        };
        const module = moduleMap[section];

        return `
            <button class="btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-primary'}" 
                onclick="${module}.load${section.charAt(0).toUpperCase() + section.slice(1)}(${page})">
                ${page}
            </button>
        `;
    }
}