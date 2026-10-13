/* MatchMeter core matching engine — pure logic, no DOM.
   100% client-side: resume text never leaves the browser. */

'use strict';

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','else','when','while','of','at','by',
  'for','with','about','into','through','during','before','after','above','below',
  'to','from','up','down','in','out','on','off','over','under','again','further',
  'once','here','there','all','any','both','each','few','more','most','other',
  'some','such','no','nor','not','only','own','same','so','than','too','very',
  'can','will','just','should','now','is','are','was','were','be','been','being',
  'have','has','had','having','do','does','did','doing','would','could','ought',
  'am','as','it','its','this','that','these','those','i','me','my','myself','we',
  'our','ours','you','your','yours','he','him','his','she','her','hers','they',
  'them','their','theirs','what','which','who','whom','whose','where','why','how',
  'because','until','between','among','per','via','within','without','including',
  'include','includes','included','etc','eg','ie','vs','also','well','across',
  'along','around','toward','towards','upon','yet','however','therefore','thus',
  'hence','although','though','since','unless','whether','either','neither',
  'much','many','lot','lots','every','everything','something','anything','nothing',
  'someone','anyone','everyone','etcetera','ie','eg','us','etc'
]);

// canonical term -> known variants (both directions are expanded at match time)
const ALIASES = {
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],  'search engine optimization': ['seo'],
  'user experience': ['ux'],
  'user interface': ['ui'],
  'key performance indicators': ['kpi', 'kpis'],
  'return on investment': ['roi'],
  'customer relationship management': ['crm'],
  'structured query language': ['sql'],
  'power bi': ['powerbi'],
  'sql server': ['mssql'],
  'postgresql': ['postgres'],
  'node.js': ['nodejs', 'node'],
  'scikit learn': ['sklearn'],
  'continuous integration': ['ci'],
  'continuous deployment': ['cd'],
  'search engine marketing': ['sem'],
  'pay per click': ['ppc'],
  'annual recurring revenue': ['arr'],
  'monthly recurring revenue': ['mrr'],
  'quality assurance': ['qa'],
  'human resources': ['hr'],
  'subject matter expert': ['sme'],
  'proof of concept': ['poc', 'pocs'],
  'minimum viable product': ['mvp'],
  'key results': ['krs'],
  'objectives and key results': ['okr', 'okrs'],
  'service level agreement': ['sla', 'slas'],
  'request for proposal': ['rfp', 'rfps']
};

const TECH_SKILLS = new Set([
  'python','sql','r','java','javascript','typescript','scala','go','rust','sas','matlab',
  'excel','vba','tableau','power bi','powerbi','looker','qlik','qlikview','qlik sense',
  'databricks','pyspark','spark','hadoop','hive','airflow','dbt','snowflake','redshift',
  'bigquery','mysql','postgresql','postgres','mssql','sql server','oracle','mongodb',
  'cassandra','redis','elasticsearch','kafka','aws','azure','gcp','google cloud',
  'docker','kubernetes','terraform','git','github','gitlab','jira','confluence',
  'salesforce','sap','hyperion','essbase','workday','netsuite','hubspot','marketo',
  'power query','power automate','powerapps','sharepoint','figma','sketch','photoshop',
  'illustrator','indesign','html','css','react','angular','vue','node.js','nodejs',
  'django','flask','fastapi','tensorflow','pytorch','scikit learn','sklearn','pandas',
  'numpy','matplotlib','seaborn','plotly','streamlit','dax','m-query','ssis','ssrs',
  'ssas','alteryx','knime','spss','stata','powerpoint','word','outlook','teams','slack',
  'notion','airtable','zapier','stripe','shopify','wordpress','ga4','google analytics',
  'adobe analytics','mixpanel','amplitude','segment','snowplow','fivetran','stitch',
  'lookml','graphql','rest api','restful','json','xml','yaml','bash','powershell',
  'linux','unix','cron','selenium','cypress','playwright','jest','pytest','unittest',
  'ci/cd','mlops','kubeflow','sagemaker','vertex ai','openai','langchain','hugging face'
]);

const BIZ_SKILLS = new Set([
  'communication','leadership','collaboration','teamwork','problem solving','critical thinking',
  'analytical thinking','attention to detail','time management','organization','adaptability',
  'creativity','stakeholder management','presentation','negotiation','mentoring','coaching',
  'strategic thinking','decision making','prioritization','ownership','accountability',
  'project management','program management','agile','scrum','kanban','waterfall','sdlc',
  'a/b testing','experimentation','forecasting','budgeting','variance analysis','financial modeling',
  'data modeling','data warehousing','etl','data pipeline','data governance','data quality',
  'dashboarding','reporting','kpi','kpis','metrics','benchmarking','root cause analysis',
  'gap analysis','requirements gathering','user stories','acceptance criteria','roadmap',
  'go-to-market','change management','risk management','vendor management','procurement',
  'cross-functional','customer success','account management','business development'
]);

function normalize(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s+#./'&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rawTokens(text) {
  const n = normalize(text);
  if (!n) return [];
  return n.split(' ')
    .map(t => t.replace(/^[./'&]+|[./'&]+$/g, ''))
    .filter(t => t.length > 0);
}

function isJunk(t) {
  return !t || t.length < 2 || STOPWORDS.has(t) || /^[0-9.,'#/&+-]+$/.test(t);
}

// Words that structure a job post but are never skills — excluded from keywords.
const STRUCTURAL = new Set([
  'job', 'jobs', 'role', 'roles', 'position', 'positions', 'title',
  'responsibilities', 'responsibility', 'responsible',
  'requirements', 'requirement', 'required', 'requires', 'require',
  'qualifications', 'qualified', 'qualify',
  'preferred', 'prefer', 'preference', 'plus', 'bonus', 'nice',
  'description', 'overview', 'summary', 'about', 'join', 'joining', 'joined',
  'looking', 'seeking', 'searching', 'hiring', 'hire',
  'candidate', 'candidates', 'applicant', 'applicants',
  'successful', 'successfully', 'ideal', 'strong', 'excellent', 'great',
  'help', 'helps', 'helping', 'work', 'works', 'working', 'worked',
  'team', 'teams', 'company', 'organization', 'business', 'department',
  'day-to-day', 'day', 'days', 'year', 'years', 'yrs', 'yr',
  'including', 'include', 'includes', 'various', 'related', 'related field',
  'field', 'degree', "bachelor's", "master's", 'bachelor', 'master', 'phd',
  'based', 'using', 'use', 'used', 'new', 'key', 'core', 'end', 'ensure',
  'drive', 'drives', 'deliver', 'delivers', 'support', 'supports',
  'maintain', 'maintains', 'build', 'builds', 'develop', 'develops',
  'create', 'creates', 'implement', 'implements', 'partner', 'partners',
  'design', 'designs', 'analyze', 'analyzes', 'manage', 'manages',
  'lead', 'leads', 'leading', 'own', 'owns', 'define', 'defines',
  'identify', 'identifies', 'translate', 'translates', 'leverage', 'leverages',
  'remote', 'hybrid', 'onsite', 'location', 'locations'
]);

// Generic role words — not keywords alone, but make bigrams meaningful.
const CORE = new Set([
  'data', 'analyst', 'analysis', 'analytics', 'engineer', 'engineering',
  'scientist', 'science', 'developer', 'development', 'manager', 'management',
  'designer', 'marketing', 'marketer', 'project', 'program'
]);

function isStructural(t) { return STRUCTURAL.has(t); }

// Extract weighted term frequencies (unigrams + bigrams; trigrams only when curated).
// Text is split into segments on clause boundaries so phrases never span
// across commas, colons, list items, or line breaks.
function extractTerms(text) {
  const normalized = normalize(text);
  const segments = normalized.split(/[,;:()!?|\n•·–—]+/);
  const freq = new Map(); // term -> {w, n}
  const add = (term, w, n) => {
    const e = freq.get(term);
    if (e) e.w += w; else freq.set(term, { w, n });
  };
  const curated = (term) =>
    TECH_SKILLS.has(term) || BIZ_SKILLS.has(term) ||
    Object.prototype.hasOwnProperty.call(ALIASES, term);
  const meaningful = (t) => TECH_SKILLS.has(t) || BIZ_SKILLS.has(t) || CORE.has(t);
  for (const seg of segments) {
    const tokens = seg.split(' ')
      .map(t => t.replace(/^[./'&]+|[./'&]+$/g, ''))
      .filter(t => t.length > 0);
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n);
        if (isJunk(gram[0]) || isJunk(gram[n - 1]) || isStructural(gram[0]) || isStructural(gram[n - 1])) continue;
        let bad = false;
        for (const t of gram) {
          if (isJunk(t) || isStructural(t)) { bad = true; break; }
        }
        if (bad) continue;
        const term = gram.join(' ');
        if (n === 3 && !curated(term)) continue; // trigrams only when meaningful
        if (n === 2 && !curated(term) && !meaningful(gram[0]) && !meaningful(gram[1])) continue;
        const boost = (TECH_SKILLS.has(term) || BIZ_SKILLS.has(term)) ? 1.6 : 1;
        add(term, (1 + 0.7 * (n - 1)) * boost, n);
      }
    }
  }
  return freq;
}

// Expand a term set with alias variants in both directions.
function expandWithAliases(termSet) {
  const out = new Set(termSet);
  for (const term of termSet) {
    for (const [canon, variants] of Object.entries(ALIASES)) {
      if (term === canon) variants.forEach(v => out.add(v));
      else if (variants.includes(term)) out.add(canon);
    }
  }
  return out;
}

function categorize(term) {
  if (TECH_SKILLS.has(term)) return 'tech';
  if (BIZ_SKILLS.has(term)) return 'biz';
  return 'other';
}

const CATEGORY_LABEL = { tech: 'Tools & tech', biz: 'Skills & methods', other: 'Keywords' };

function analyze(resumeText, jdText) {
  const jdTerms = extractTerms(jdText);
  const resumeTerms = expandWithAliases(new Set([...extractTerms(resumeText).keys()]));

  // Rank JD terms by weight, keep the meaningful head.
  const ranked = [...jdTerms.entries()]
    .filter(([, e]) => e.w >= 1.4)
    .sort((a, b) => b[1].w - a[1].w)
    .slice(0, 45);

  const totalWeight = ranked.reduce((s, [, e]) => s + e.w, 0);
  if (totalWeight === 0) {
    return { error: 'EMPTY_JD', score: 0, matched: [], missing: [], categories: {}, suggestions: [] };
  }

  const matched = [];
  const missing = [];
  for (const [term, e] of ranked) {
    const hit = resumeTerms.has(term);
    const entry = { term, weight: Math.round(e.w * 10) / 10 };
    (hit ? matched : missing).push(entry);
  }

  const matchedWeight = matched.reduce((s, m) => s + m.weight, 0);
  const score = Math.min(99, Math.round((matchedWeight / totalWeight) * 100));

  const byCat = { tech: { matched: 0, total: 0 }, biz: { matched: 0, total: 0 }, other: { matched: 0, total: 0 } };
  for (const m of matched) byCat[categorize(m.term)].matched++;
  for (const m of missing) byCat[categorize(m.term)].total++;
  for (const k of Object.keys(byCat)) byCat[k].total += byCat[k].matched;

  missing.sort((a, b) => b.weight - a.weight);
  matched.sort((a, b) => b.weight - a.weight);

  const topMissing = missing.slice(0, 12);
  const suggestions = topMissing.slice(0, 5).map(m => {
    const cat = categorize(m.term);
    const where = cat === 'tech'
      ? 'Add it to your skills section and, where true, into a bullet describing where you used it.'
      : cat === 'biz'
        ? 'Weave it into a bullet with a concrete example — hiring managers skim for proof, not claims.'
        : 'If it reflects your experience, work it naturally into your summary or a relevant bullet.';
    return { term: m.term, tip: `The job description emphasizes “${m.term}”. ${where}` };
  });

  return { score, matched, missing: topMissing, allMissingCount: missing.length, categories: byCat, suggestions, jdKeywordCount: ranked.length };
}

function verdict(score) {
  if (score >= 75) return { label: 'Strong match', blurb: 'Your resume speaks their language. Apply with confidence.' };
  if (score >= 55) return { label: 'Good match', blurb: 'Solid foundation — a few targeted tweaks could put you over the top.' };
  if (score >= 35) return { label: 'Needs work', blurb: 'You are missing keywords the ATS and recruiters will scan for.' };
  return { label: 'Weak match', blurb: 'Tailor this resume before applying, or save your energy for a closer fit.' };
}

// Node export guard (browser loads this via <script>).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyze, verdict, normalize, extractTerms, STOPWORDS, TECH_SKILLS };
}
