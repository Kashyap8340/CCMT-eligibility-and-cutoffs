let mappingData = [];
let orcrData = [];
let uniqueGatePapers = new Set();
let uniqueColleges = new Set();

let globalResults = [];
let globalCategory = "OPEN";

const btechInput = document.getElementById('btech-degree');
const gateSelect = document.getElementById('gate-paper');
const collegeSelect = document.getElementById('college');
const categorySelect = document.getElementById('category');
const checkBtn = document.getElementById('check-btn');
const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');
const resultsTitle = document.getElementById('results-title');
const loading = document.getElementById('loading');

const resultsToolbar = document.getElementById('results-toolbar');
const resultSearch = document.getElementById('result-search');
const gateScoreFilter = document.getElementById('gate-score-filter');
const resultSort = document.getElementById('result-sort');

async function loadData() {
    try {
        const [mappingRes, orcrRes] = await Promise.all([
            fetch('../ccmt_mapping.json').catch(() => null),
            fetch('orcr_mapping.json').catch(() => null)
        ]);

        if (mappingRes && mappingRes.ok) {
            mappingData = await mappingRes.json();
        } else {
            // try looking in the same folder if ../ fails (depending on serve config)
            const fallbackRes = await fetch('ccmt_mapping.json');
            mappingData = await fallbackRes.json();
        }

        if (orcrRes && orcrRes.ok) {
            orcrData = await orcrRes.json();
        }

        // Extract unique options
        mappingData.forEach(item => {
            uniqueGatePapers.add(item.gate_paper);
            uniqueColleges.add(item.institute);
        });

        // Populate GATE papers
        Array.from(uniqueGatePapers).sort().forEach(paper => {
            const option = document.createElement('option');
            option.value = paper;
            option.textContent = paper;
            gateSelect.appendChild(option);
        });

        // Populate Colleges
        Array.from(uniqueColleges).sort().forEach(college => {
            const option = document.createElement('option');
            option.value = college;
            option.textContent = college;
            collegeSelect.appendChild(option);
        });

    } catch (err) {
        console.error("Error loading data:", err);
        resultsTitle.textContent = "Error loading data. Please make sure the JSON files exist.";
        resultsSection.classList.remove('hidden');
    }
}

function normalize(str) {
    if (!str) return "";
    // Remove trailing code like -(BT) or -(T999) from programs and institutes
    let s = str.replace(/-\([^)]+\)$/, '').trim();
    return s.replace(/&/g, 'and')
            .replace(/,/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .toLowerCase();
}

function findCutoff(institute, pgProgram, category) {
    if (!category || category === "ALL") category = "OPEN"; // Default to OPEN if none selected
    
    // Normalize string to handle slight inconsistencies between tables
    const normInst = normalize(institute);
    const normProg = normalize(pgProgram);
    const normCat = normalize(category);

    const match = orcrData.find(o => 
        normalize(o.institute) === normInst && 
        normalize(o.pg_program) === normProg && 
        normalize(o.category) === normCat
    );

    return match ? { max: match.max_score, min: match.min_score } : null;
}

function renderResults(results, category) {
    resultsGrid.innerHTML = '';
    resultsTitle.textContent = `Eligible Courses (${results.length})`;
    
    if (results.length === 0) {
        resultsGrid.innerHTML = '<p style="color: var(--black); font-weight: bold; grid-column: 1/-1; border: 4px solid var(--black); padding: 2rem; background: var(--white); box-shadow: 8px 8px 0px 0px var(--black);">No eligible courses found for the given criteria. Try adjusting your B.Tech course or checking the exact name in CCMT rules.</p>';
        return;
    }

    results.forEach(item => {
        const cutoff = findCutoff(item.institute, item.pg_program, category);
        const cutoffHtml = cutoff ? `
            <div class="cutoff-container">
                <div class="cutoff-badge max">
                    <span class="cutoff-label">Max Score</span>
                    <span class="cutoff-value">${cutoff.max}</span>
                </div>
                <div class="cutoff-badge min">
                    <span class="cutoff-label">Min Score</span>
                    <span class="cutoff-value">${cutoff.min}</span>
                </div>
            </div>
        ` : `<div class="meta" style="margin-top:0.5rem;text-align:center;"><em>No cutoff data available for this category</em></div>`;

        const decorShapes = ['circle', 'square', 'triangle'];
        const randomShape = decorShapes[Math.floor(Math.random() * decorShapes.length)];

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-decor ${randomShape}"></div>
            <h3>${item.institute}</h3>
            <div class="dept">${item.department}</div>
            <div class="meta">
                <strong>PG Program</strong> ${item.pg_program}
            </div>
            <div class="meta">
                <strong>Eligible GATE Paper</strong> ${item.gate_paper}
            </div>
            <div class="meta">
                <strong>Req. Qualifying Degree</strong> ${item.qualifying_degree}
            </div>
            ${cutoffHtml}
        `;
        resultsGrid.appendChild(card);
    });
}

function checkEligibility() {
    resultsSection.classList.remove('hidden');
    resultsGrid.innerHTML = '';
    loading.classList.remove('hidden');
    resultsToolbar.classList.add('hidden');
    resultsTitle.textContent = "Searching...";

    setTimeout(() => {
        const btechTerm = btechInput.value.toLowerCase().trim();
        const selectedGate = gateSelect.value;
        const selectedCollege = collegeSelect.value;
        const selectedCategory = categorySelect.value;

        // Ensure unique combinations of institute and pg_program so we don't display duplicate cards
        // because the mapping file has many rows for the same program (different valid degrees)
        const seenCourses = new Set();
        const uniqueResults = [];

        for (const item of mappingData) {
            // Check college
            if (selectedCollege === 'GROUP_NIT') {
                if (!item.institute.toLowerCase().includes('national institute of technology')) {
                    continue;
                }
            } else if (selectedCollege === 'GROUP_IIIT') {
                if (!item.institute.toLowerCase().includes('indian institute of information technology')) {
                    continue;
                }
            } else if (selectedCollege === 'GROUP_CFTI') {
                const instLower = item.institute.toLowerCase();
                if (instLower.includes('national institute of technology') || instLower.includes('indian institute of information technology')) {
                    continue;
                }
            } else if (selectedCollege !== 'ALL' && item.institute !== selectedCollege) {
                continue;
            }

            // Check GATE Paper
            if (selectedGate && item.gate_paper !== selectedGate) {
                continue;
            }

            // Check B.Tech Course Match
            const qualDegree = item.qualifying_degree.toLowerCase();
            if (btechTerm) {
                const isMatch = qualDegree.includes(btechTerm) || 
                                qualDegree.includes('any of the disciplines') || 
                                qualDegree.includes('any branch');
                if (!isMatch) continue;
            }

            const uniqueKey = item.institute + "||" + item.pg_program;
            if (!seenCourses.has(uniqueKey)) {
                seenCourses.add(uniqueKey);
                uniqueResults.push(item);
            }
        }

        globalResults = uniqueResults;
        globalCategory = selectedCategory;

        loading.classList.add('hidden');
        if (globalResults.length > 0) {
            resultsToolbar.classList.remove('hidden');
        }
        applyFiltersAndRender();
    }, 500);
}

function applyFiltersAndRender() {
    let filtered = [...globalResults];
    
    const searchTerm = resultSearch.value.toLowerCase().trim();
    const gateScore = gateScoreFilter.value ? parseInt(gateScoreFilter.value, 10) : null;
    const sortBy = resultSort.value;

    // 1. Search Filter
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.institute.toLowerCase().includes(searchTerm) || 
            item.pg_program.toLowerCase().includes(searchTerm) ||
            item.department.toLowerCase().includes(searchTerm)
        );
    }

    // 2. GATE Score Filter
    if (gateScore !== null && !isNaN(gateScore)) {
        filtered = filtered.filter(item => {
            const cutoff = findCutoff(item.institute, item.pg_program, globalCategory);
            if (!cutoff) return false; // Hide if no historical cutoff data to compare against
            return gateScore >= cutoff.min;
        });
    }

    // 3. Sort
    filtered.sort((a, b) => {
        if (sortBy === 'alphabetical') {
            return a.institute.localeCompare(b.institute) || a.pg_program.localeCompare(b.pg_program);
        } else {
            const cutoffA = findCutoff(a.institute, a.pg_program, globalCategory);
            const cutoffB = findCutoff(b.institute, b.pg_program, globalCategory);
            
            // Push items with missing cutoffs to the bottom
            if (!cutoffA && !cutoffB) return 0;
            if (!cutoffA) return 1;
            if (!cutoffB) return -1;

            if (sortBy === 'highest-max') {
                return cutoffB.max - cutoffA.max; // Descending max cutoff
            } else if (sortBy === 'lowest-min') {
                return cutoffA.min - cutoffB.min; // Ascending min cutoff
            }
        }
        return 0;
    });

    renderResults(filtered, globalCategory);
}

// Initialization
loadData();
checkBtn.addEventListener('click', checkEligibility);

resultSearch.addEventListener('input', applyFiltersAndRender);
gateScoreFilter.addEventListener('input', applyFiltersAndRender);
resultSort.addEventListener('change', applyFiltersAndRender);
