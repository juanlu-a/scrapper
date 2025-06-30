const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

class FinalDiseaseMatcher {
    constructor() {
        this.mayoData = [];
        this.drugsData = [];
        this.finalResults = [];
    }

    // Load Mayo Clinic data
    async loadMayoData() {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream('./CSV/diagnosis_treatment_data_final.csv')
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    this.mayoData = results;
                    console.log(`✅ Loaded ${results.length} Mayo Clinic diseases`);
                    resolve(results);
                })
                .on('error', reject);
        });
    }

    // Load Drugs.com disease-drug relationships
    async loadDrugsData() {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream('./CSV/diseases_drugs_families.csv')
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    this.drugsData = results;
                    console.log(`✅ Loaded ${results.length} drug-disease relationships`);
                    resolve(results);
                })
                .on('error', reject);
        });
    }

    // Spanish translations for common diseases
    translateToSpanish(englishName) {
        const translations = {
            // Common diseases
            'diabetes': 'diabetes',
            'hypertension': 'hipertensión',
            'asthma': 'asma',
            'depression': 'depresión',
            'anxiety': 'ansiedad',
            'cancer': 'cáncer',
            'arthritis': 'artritis',
            'migraine': 'migraña',
            'pneumonia': 'neumonía',
            'bronchitis': 'bronquitis',
            'stroke': 'accidente cerebrovascular',
            'epilepsy': 'epilepsia',
            'osteoporosis': 'osteoporosis',
            'anemia': 'anemia',
            'infection': 'infección',
            'inflammation': 'inflamación',
            'pain': 'dolor',
            'fever': 'fiebre',
            'allergy': 'alergia',
            'heart disease': 'enfermedad cardíaca',
            'kidney disease': 'enfermedad renal',
            'liver disease': 'enfermedad hepática',
            
            // Specific conditions
            'abdominal aortic aneurysm': 'aneurisma aórtico abdominal',
            'absence seizure': 'crisis de ausencia',
            'acanthosis nigricans': 'acantosis nigricans',
            'achalasia': 'acalasia',
            'achilles tendinitis': 'tendinitis de aquiles',
            'achilles tendon rupture': 'ruptura del tendón de aquiles',
            'acl injury': 'lesión del ligamento cruzado anterior',
            'acne': 'acné',
            'acoustic neuroma': 'neuroma acústico',
            'acute coronary syndrome': 'síndrome coronario agudo',
            'acute kidney injury': 'lesión renal aguda',
            'acute liver failure': 'insuficiencia hepática aguda',
            'addison\'s disease': 'enfermedad de addison',
            'alzheimer\'s disease': 'enfermedad de alzheimer',
            'angina': 'angina de pecho',
            'appendicitis': 'apendicitis',
            'atrial fibrillation': 'fibrilación auricular',
            'autism spectrum disorder': 'trastorno del espectro autista',
            'back pain': 'dolor de espalda',
            'bipolar disorder': 'trastorno bipolar',
            'bladder cancer': 'cáncer de vejiga',
            'blood clot': 'coágulo sanguíneo',
            'bone cancer': 'cáncer de hueso',
            'brain tumor': 'tumor cerebral',
            'breast cancer': 'cáncer de mama',
            'broken bone': 'hueso roto',
            'cataracts': 'cataratas',
            'cerebral palsy': 'parálisis cerebral',
            'chest pain': 'dolor en el pecho',
            'chronic fatigue': 'fatiga crónica',
            'chronic pain': 'dolor crónico',
            'colon cancer': 'cáncer de colon',
            'common cold': 'resfriado común',
            'constipation': 'estreñimiento',
            'crohn\'s disease': 'enfermedad de crohn',
            'cystic fibrosis': 'fibrosis quística',
            'dementia': 'demencia',
            'diarrhea': 'diarrea',
            'eating disorder': 'trastorno alimentario',
            'eczema': 'eccema',
            'endometriosis': 'endometriosis',
            'gallstones': 'cálculos biliares',
            'gastroesophageal reflux': 'reflujo gastroesofágico',
            'glaucoma': 'glaucoma',
            'gout': 'gota',
            'hashimoto\'s disease': 'enfermedad de hashimoto',
            'heart attack': 'infarto',
            'heart failure': 'insuficiencia cardíaca',
            'hemorrhoids': 'hemorroides',
            'hepatitis': 'hepatitis',
            'high blood pressure': 'presión arterial alta',
            'high cholesterol': 'colesterol alto',
            'hiv/aids': 'vih/sida',
            'huntington\'s disease': 'enfermedad de huntington',
            'hypothyroidism': 'hipotiroidismo',
            'inflammatory bowel disease': 'enfermedad inflamatoria intestinal',
            'insomnia': 'insomnio',
            'irritable bowel syndrome': 'síndrome del intestino irritable',
            'kidney stones': 'cálculos renales',
            'leukemia': 'leucemia',
            'lung cancer': 'cáncer de pulmón',
            'lupus': 'lupus',
            'lyme disease': 'enfermedad de lyme',
            'multiple sclerosis': 'esclerosis múltiple',
            'obesity': 'obesidad',
            'parkinson\'s disease': 'enfermedad de parkinson',
            'pneumonia': 'neumonía',
            'prostate cancer': 'cáncer de próstata',
            'psoriasis': 'psoriasis',
            'rheumatoid arthritis': 'artritis reumatoide',
            'schizophrenia': 'esquizofrenia',
            'scoliosis': 'escoliosis',
            'skin cancer': 'cáncer de piel',
            'sleep apnea': 'apnea del sueño',
            'stomach cancer': 'cáncer de estómago',
            'thyroid cancer': 'cáncer de tiroides',
            'tuberculosis': 'tuberculosis',
            'type 1 diabetes': 'diabetes tipo 1',
            'type 2 diabetes': 'diabetes tipo 2',
            'ulcerative colitis': 'colitis ulcerosa',
            'urinary tract infection': 'infección del tracto urinario'
        };

        const normalized = englishName.toLowerCase().trim();
        
        // Check for exact matches first
        if (translations[normalized]) {
            return translations[normalized];
        }
        
        // Check for partial matches
        for (const [english, spanish] of Object.entries(translations)) {
            if (normalized.includes(english) || english.includes(normalized)) {
                return spanish;
            }
        }
        
        // If no translation found, keep the original name
        return englishName;
    }

    // Normalize disease names for matching
    normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    // Calculate similarity between two disease names
    calculateSimilarity(name1, name2) {
        const n1 = this.normalizeName(name1);
        const n2 = this.normalizeName(name2);
        
        // Exact match
        if (n1 === n2) return 1.0;
        
        // One contains the other
        if (n1.includes(n2) || n2.includes(n1)) return 0.85;
        
        // Word-based similarity
        const words1 = n1.split(' ').filter(w => w.length > 2);
        const words2 = n2.split(' ').filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        const commonWords = words1.filter(word => words2.includes(word));
        return (commonWords.length * 2) / (words1.length + words2.length);
    }

    // Clean text fields
    cleanText(text) {
        if (!text || text === 'Information not found' || 
            text === 'Tests information not found' || 
            text === 'Treatment information not found' || 
            text === 'Medications information not found') {
            return '';
        }
        return text.replace(/\s+/g, ' ').trim();
    }

    // Match diseases and combine data
    async matchDiseases() {
        console.log('🔍 Matching diseases between Mayo Clinic and Drugs.com...');
        
        const processedDiseases = new Set();
        
        for (const mayoDisease of this.mayoData) {
            const diseaseName = mayoDisease.Disease;
            
            // Skip if already processed
            if (processedDiseases.has(diseaseName)) continue;
            processedDiseases.add(diseaseName);
            
            console.log(`Processing: ${diseaseName}`);
            
            // Find matching drugs from Drugs.com
            const matchingDrugs = new Set();
            
            for (const drugEntry of this.drugsData) {
                const similarity = this.calculateSimilarity(diseaseName, drugEntry.Disease);
                
                if (similarity >= 0.6) { // 60% similarity threshold
                    if (drugEntry.Drug_Name && drugEntry.Drug_Name !== 'Prescribing Information') {
                        matchingDrugs.add(drugEntry.Drug_Name);
                    }
                }
            }
            
            // Create final record
            const finalRecord = {
                diseaseNameEnglish: diseaseName,
                diseaseNameSpanish: this.translateToSpanish(diseaseName),
                diagnosis: this.cleanText(mayoDisease.Diagnosis),
                treatments: this.cleanText(mayoDisease.Treatment),
                tests: this.cleanText(mayoDisease.Tests),
                medications: Array.from(matchingDrugs).join('; ')
            };
            
            this.finalResults.push(finalRecord);
        }
        
        console.log(`✅ Matched ${this.finalResults.length} diseases`);
        console.log(`✅ Found medications for ${this.finalResults.filter(d => d.medications).length} diseases`);
    }

    // Save results to CSV
    async saveResults() {
        const outputFile = './CSV/final_diseases_complete.csv';
        
        const csvWriter = createObjectCsvWriter({
            path: outputFile,
            header: [
                { id: 'diseaseNameEnglish', title: 'Disease_Name_English' },
                { id: 'diseaseNameSpanish', title: 'Disease_Name_Spanish' },
                { id: 'diagnosis', title: 'Diagnosis' },
                { id: 'treatments', title: 'Treatments' },
                { id: 'tests', title: 'Tests' },
                { id: 'medications', title: 'Medications_Drugs' }
            ]
        });

        await csvWriter.writeRecords(this.finalResults);
        console.log(`✅ Results saved to ${outputFile}`);
        
        return outputFile;
    }

    // Generate summary report
    generateReport() {
        const totalDiseases = this.finalResults.length;
        const diseasesWithMeds = this.finalResults.filter(d => d.medications).length;
        const diseasesWithoutMeds = totalDiseases - diseasesWithMeds;
        
        console.log('\n' + '='.repeat(50));
        console.log('           FINAL MATCHING REPORT');
        console.log('='.repeat(50));
        console.log(`📊 Total diseases processed: ${totalDiseases}`);
        console.log(`💊 Diseases with medications: ${diseasesWithMeds} (${(diseasesWithMeds/totalDiseases*100).toFixed(1)}%)`);
        console.log(`❌ Diseases without medications: ${diseasesWithoutMeds} (${(diseasesWithoutMeds/totalDiseases*100).toFixed(1)}%)`);
        
        // Top diseases by medication count
        const diseasesWithMedCounts = this.finalResults
            .filter(d => d.medications)
            .map(d => ({
                name: d.diseaseNameEnglish,
                spanish: d.diseaseNameSpanish,
                medCount: d.medications.split('; ').length
            }))
            .sort((a, b) => b.medCount - a.medCount)
            .slice(0, 10);
        
        console.log('\n🏆 TOP 10 DISEASES BY MEDICATION COUNT:');
        diseasesWithMedCounts.forEach((disease, index) => {
            console.log(`   ${index + 1}. ${disease.name} (${disease.spanish}): ${disease.medCount} medications`);
        });
        
        console.log('\n📁 Output file: ./CSV/final_diseases_complete.csv');
        console.log('='.repeat(50));
    }

    // Main execution method
    async execute() {
        try {
            console.log('🚀 Starting Final Disease Matching Process...\n');
            
            // Load data
            await this.loadMayoData();
            await this.loadDrugsData();
            
            // Process matches
            await this.matchDiseases();
            
            // Save results
            await this.saveResults();
            
            // Generate report
            this.generateReport();
            
            console.log('\n✅ Process completed successfully!');
            
        } catch (error) {
            console.error('❌ Error during processing:', error);
            throw error;
        }
    }
}

// Execute the final matching process
if (require.main === module) {
    const matcher = new FinalDiseaseMatcher();
    matcher.execute().catch(console.error);
}

module.exports = FinalDiseaseMatcher;
