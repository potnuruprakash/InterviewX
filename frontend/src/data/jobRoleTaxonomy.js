/**
 * InterviewX — Job Role Taxonomy
 *
 * Central data structure for:
 *   - Searchable role dropdown (Step 1)
 *   - Competency profiles per role (Step 2 skill gap display)
 *   - Detected requirements chips (Step 1 preview)
 *
 * Add new roles/competencies here — no UI changes needed.
 */

// ── Competency Area Definitions ───────────────────────────────────────────────
// Each area defines the canonical skills that belong to it.
// Used for "related skill" detection in competency match scoring.

export const COMPETENCY_AREAS = {
  FRONTEND: {
    id: 'frontend',
    label: 'Frontend Development',
    icon: '🖥️',
    skills: [
      'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Vue.js',
      'Next.js', 'Nuxt.js', 'Bootstrap', 'Tailwind CSS', 'Sass', 'SCSS', 'Redux',
      'Webpack', 'Vite', 'jQuery', 'Responsive Design', 'Web Accessibility', 'ARIA',
      'Material UI', 'Chakra UI', 'Ant Design', 'React Router', 'Zustand', 'MobX',
    ],
  },
  BACKEND: {
    id: 'backend',
    label: 'Backend Development',
    icon: '⚙️',
    skills: [
      'Java', 'Python', 'Node.js', 'C#', 'PHP', 'Ruby', 'Go', 'Golang', 'Rust',
      'Spring Boot', 'Spring Framework', 'Django', 'Flask', 'FastAPI', 'Express.js',
      'NestJS', 'Laravel', 'ASP.NET', '.NET Core', 'REST APIs', 'RESTful APIs',
      'GraphQL', 'Authentication', 'JWT', 'OAuth', 'Session Management',
      'Microservices', 'API Development', 'Server-side Development',
    ],
  },
  DATABASE: {
    id: 'database',
    label: 'Database',
    icon: '🗄️',
    skills: [
      'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle',
      'Firebase', 'DynamoDB', 'Cassandra', 'ElasticSearch', 'NoSQL',
      'Database Design', 'Query Optimization', 'ORM', 'Hibernate', 'Sequelize',
      'Mongoose', 'Prisma', 'Indexing', 'ACID', 'Transactions',
    ],
  },
  DEVOPS: {
    id: 'devops',
    label: 'DevOps & Tools',
    icon: '🔧',
    skills: [
      'Git', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'GitHub Actions',
      'GitLab CI', 'CircleCI', 'Linux', 'Bash', 'Shell Scripting', 'Nginx',
      'Apache', 'Maven', 'Gradle', 'npm', 'Webpack', 'Ansible', 'Terraform',
      'Infrastructure as Code', 'Monitoring', 'Prometheus', 'Grafana', 'ELK Stack',
    ],
  },
  CLOUD: {
    id: 'cloud',
    label: 'Cloud Platforms',
    icon: '☁️',
    skills: [
      'AWS', 'Azure', 'GCP', 'Google Cloud', 'S3', 'EC2', 'Lambda',
      'Cloud Functions', 'Cloud Run', 'RDS', 'Cloud Storage', 'CloudFront',
      'Azure Functions', 'Heroku', 'Vercel', 'Netlify', 'DigitalOcean',
      'Cloud Architecture', 'Serverless',
    ],
  },
  TESTING: {
    id: 'testing',
    label: 'Testing',
    icon: '🧪',
    skills: [
      'Unit Testing', 'Integration Testing', 'Jest', 'JUnit', 'Pytest', 'Mocha',
      'Jasmine', 'Selenium', 'Cypress', 'Playwright', 'API Testing', 'Postman',
      'TDD', 'BDD', 'Test Automation', 'TestNG', 'Load Testing', 'Performance Testing',
      'E2E Testing', 'Regression Testing', 'Mockito',
    ],
  },
  ARCHITECTURE: {
    id: 'architecture',
    label: 'Architecture',
    icon: '🏗️',
    skills: [
      'System Design', 'MVC', 'Microservices', 'REST API Design', 'Scalability',
      'Design Patterns', 'SOLID Principles', 'Event-Driven Architecture',
      'Message Queues', 'Kafka', 'RabbitMQ', 'DDD', 'CQRS', 'Event Sourcing',
      'High Availability', 'Load Balancing', 'Caching Strategies',
    ],
  },
  MOBILE: {
    id: 'mobile',
    label: 'Mobile Development',
    icon: '📱',
    skills: [
      'Android', 'iOS', 'React Native', 'Flutter', 'Kotlin', 'Swift',
      'Java Android', 'Dart', 'Xamarin', 'Ionic', 'Mobile UI', 'Push Notifications',
      'App Store', 'Play Store', 'Mobile Performance', 'Offline-first',
    ],
  },
  DATA: {
    id: 'data',
    label: 'Data & Analytics',
    icon: '📊',
    skills: [
      'Python', 'R', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Plotly',
      'Data Analysis', 'Data Visualization', 'Power BI', 'Tableau', 'Excel',
      'Statistics', 'ETL', 'SQL', 'Spark', 'Hadoop', 'Airflow', 'dbt',
      'Data Warehousing', 'OLAP',
    ],
  },
  ML_AI: {
    id: 'ml_ai',
    label: 'Machine Learning & AI',
    icon: '🤖',
    skills: [
      'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras',
      'scikit-learn', 'NLP', 'Computer Vision', 'Neural Networks', 'CNNs', 'RNNs',
      'Transformers', 'Feature Engineering', 'Model Deployment', 'MLOps',
      'Hugging Face', 'LangChain', 'Generative AI', 'LLMs', 'Prompt Engineering',
      'RAG', 'OpenAI API', 'Stable Diffusion',
    ],
  },
  SECURITY: {
    id: 'security',
    label: 'Cybersecurity',
    icon: '🔒',
    skills: [
      'Cybersecurity', 'Network Security', 'OWASP', 'Penetration Testing',
      'Vulnerability Assessment', 'Encryption', 'SSL/TLS', 'Firewall',
      'SIEM', 'SOC', 'IAM', 'PKI', 'Ethical Hacking', 'Incident Response',
      'Threat Intelligence', 'Security Auditing', 'Zero Trust',
    ],
  },
  QA: {
    id: 'qa',
    label: 'Quality Assurance',
    icon: '✅',
    skills: [
      'Manual Testing', 'Automated Testing', 'Selenium', 'Cypress', 'TestNG',
      'QA Methodology', 'Bug Tracking', 'JIRA', 'Test Planning', 'Test Cases',
      'Performance Testing', 'Load Testing', 'Appium', 'Robot Framework',
      'API Testing', 'Database Testing', 'Regression Testing',
    ],
  },
}

// ── Role Competency Profiles ──────────────────────────────────────────────────
// Maps each role to competency areas with key skills to evaluate.
// `weight`: 'primary' | 'secondary' — affects display order
// `keySkills`: The specific skills to show as required for this role

export const ROLE_COMPETENCY_PROFILES = {
  'Full Stack Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'] },
      { area: 'BACKEND', weight: 'primary', keySkills: ['Node.js', 'REST APIs', 'Authentication', 'Express.js'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'MongoDB', 'Database Design'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'CI/CD'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'Cloud Architecture'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'API Testing', 'Jest'] },
    ],
    detectedRequirements: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'REST APIs', 'Docker'],
  },
  'Java Full Stack Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Java', 'Spring Boot', 'REST APIs', 'Authentication', 'Microservices'] },
      { area: 'FRONTEND', weight: 'primary', keySkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Angular'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'PostgreSQL', 'Hibernate'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Maven', 'Docker', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['JUnit', 'Mockito', 'Integration Testing'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'Azure'] },
    ],
    detectedRequirements: ['Java', 'Spring Boot', 'HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Git', 'REST APIs', 'JUnit'],
  },
  'Python Full Stack Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Python', 'Django', 'Flask', 'FastAPI', 'REST APIs'] },
      { area: 'FRONTEND', weight: 'primary', keySkills: ['HTML', 'CSS', 'JavaScript', 'React'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'PostgreSQL', 'MongoDB', 'Redis'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'CI/CD', 'Linux'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Pytest', 'Unit Testing', 'API Testing'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'GCP'] },
    ],
    detectedRequirements: ['Python', 'Django', 'HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'PostgreSQL', 'Git', 'REST APIs'],
  },
  'MERN Stack Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['React', 'JavaScript', 'HTML', 'CSS', 'Redux'] },
      { area: 'BACKEND', weight: 'primary', keySkills: ['Node.js', 'Express.js', 'REST APIs', 'Authentication'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['MongoDB', 'Mongoose', 'Database Design'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'npm', 'Docker'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Jest', 'Unit Testing', 'API Testing'] },
    ],
    detectedRequirements: ['React', 'Node.js', 'Express.js', 'MongoDB', 'JavaScript', 'HTML', 'CSS', 'Git', 'REST APIs'],
  },
  'Frontend Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'npm', 'Webpack', 'Vite'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Jest', 'Cypress', 'Unit Testing'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Design Patterns', 'SOLID Principles'] },
    ],
    detectedRequirements: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Git', 'Responsive Design'],
  },
  'React Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Redux', 'React Router', 'Next.js'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['REST APIs', 'GraphQL', 'Node.js'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'npm', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Jest', 'React Testing Library', 'Cypress'] },
    ],
    detectedRequirements: ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Redux', 'Git', 'REST APIs'],
  },
  'Angular Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['Angular', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'RxJS'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['REST APIs', 'Node.js'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'npm', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Jest', 'Jasmine', 'Karma'] },
    ],
    detectedRequirements: ['Angular', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'RxJS', 'Git', 'REST APIs'],
  },
  'JavaScript Developer': {
    competencies: [
      { area: 'FRONTEND', weight: 'primary', keySkills: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue'] },
      { area: 'BACKEND', weight: 'primary', keySkills: ['Node.js', 'Express.js', 'REST APIs'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['MongoDB', 'SQL', 'Redis'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'npm', 'Docker'] },
    ],
    detectedRequirements: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'HTML', 'CSS', 'Git', 'REST APIs'],
  },
  'Backend Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Node.js', 'Python', 'Java', 'REST APIs', 'Authentication', 'Microservices'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'Linux', 'CI/CD'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'Cloud Architecture'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'Integration Testing', 'API Testing'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Microservices', 'System Design', 'API Design'] },
    ],
    detectedRequirements: ['Node.js', 'Python', 'REST APIs', 'SQL', 'Docker', 'Git', 'Authentication', 'Microservices'],
  },
  'Java Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Java', 'Spring Boot', 'Spring Framework', 'REST APIs', 'Microservices', 'Authentication'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'PostgreSQL', 'Hibernate', 'JPA'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Maven', 'Gradle', 'Docker', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['JUnit', 'Mockito', 'Integration Testing'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'Azure'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Microservices', 'Design Patterns', 'SOLID Principles'] },
    ],
    detectedRequirements: ['Java', 'Spring Boot', 'REST APIs', 'SQL', 'MySQL', 'Git', 'Maven', 'JUnit', 'Hibernate'],
  },
  'Python Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Python', 'Django', 'Flask', 'FastAPI', 'REST APIs'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'PostgreSQL', 'MongoDB', 'Redis'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'Linux', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Pytest', 'Unit Testing', 'API Testing'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'GCP'] },
    ],
    detectedRequirements: ['Python', 'Django', 'Flask', 'REST APIs', 'SQL', 'PostgreSQL', 'Git', 'Docker'],
  },
  'Node.js Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Node.js', 'Express.js', 'NestJS', 'REST APIs', 'GraphQL', 'Authentication'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['MongoDB', 'SQL', 'PostgreSQL', 'Redis'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'npm', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Jest', 'Mocha', 'API Testing', 'Unit Testing'] },
    ],
    detectedRequirements: ['Node.js', 'Express.js', 'REST APIs', 'MongoDB', 'SQL', 'Git', 'JavaScript', 'TypeScript'],
  },
  '.NET Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['C#', '.NET Core', 'ASP.NET', 'REST APIs', 'Authentication'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'SQL Server', 'PostgreSQL', 'Entity Framework'] },
      { area: 'FRONTEND', weight: 'secondary', keySkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Angular'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'Azure DevOps', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['NUnit', 'xUnit', 'Unit Testing'] },
    ],
    detectedRequirements: ['C#', '.NET Core', 'ASP.NET', 'REST APIs', 'SQL', 'Git', 'Docker', 'Azure'],
  },
  'DevOps Engineer': {
    competencies: [
      { area: 'DEVOPS', weight: 'primary', keySkills: ['Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'Bash', 'Ansible', 'Terraform'] },
      { area: 'CLOUD', weight: 'primary', keySkills: ['AWS', 'Azure', 'GCP', 'Cloud Architecture'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Python', 'Bash', 'REST APIs'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['SQL', 'Redis'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Microservices', 'High Availability', 'Load Balancing'] },
    ],
    detectedRequirements: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'AWS', 'Ansible', 'Terraform', 'Git', 'Jenkins'],
  },
  'Cloud Engineer': {
    competencies: [
      { area: 'CLOUD', weight: 'primary', keySkills: ['AWS', 'Azure', 'GCP', 'Cloud Architecture', 'Serverless', 'Cloud Storage', 'Cloud Functions'] },
      { area: 'DEVOPS', weight: 'primary', keySkills: ['Terraform', 'Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Ansible'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Python', 'REST APIs', 'Node.js'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['High Availability', 'Scalability', 'Load Balancing'] },
    ],
    detectedRequirements: ['AWS', 'Azure', 'GCP', 'Terraform', 'Docker', 'Kubernetes', 'Linux', 'CI/CD'],
  },
  'Data Analyst': {
    competencies: [
      { area: 'DATA', weight: 'primary', keySkills: ['SQL', 'Python', 'Excel', 'Data Analysis', 'Data Visualization', 'Power BI', 'Tableau'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'PostgreSQL', 'Database Design'] },
      { area: 'ML_AI', weight: 'secondary', keySkills: ['scikit-learn', 'Machine Learning', 'Statistics'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Python'] },
    ],
    detectedRequirements: ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau', 'Data Analysis', 'Data Visualization'],
  },
  'Data Scientist': {
    competencies: [
      { area: 'ML_AI', weight: 'primary', keySkills: ['Machine Learning', 'Deep Learning', 'scikit-learn', 'TensorFlow', 'PyTorch', 'NLP', 'Feature Engineering'] },
      { area: 'DATA', weight: 'primary', keySkills: ['Python', 'R', 'Pandas', 'NumPy', 'Statistics', 'Data Analysis', 'Data Visualization'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['SQL', 'MongoDB', 'BigQuery'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'GCP', 'Azure'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'MLOps'] },
    ],
    detectedRequirements: ['Python', 'Machine Learning', 'TensorFlow', 'scikit-learn', 'SQL', 'Statistics', 'Pandas', 'NumPy'],
  },
  'Machine Learning Engineer': {
    competencies: [
      { area: 'ML_AI', weight: 'primary', keySkills: ['Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'scikit-learn', 'Model Deployment', 'MLOps', 'Feature Engineering'] },
      { area: 'DATA', weight: 'primary', keySkills: ['Python', 'Pandas', 'NumPy', 'Data Analysis'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Python', 'REST APIs', 'FastAPI', 'Flask'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Docker', 'Kubernetes', 'CI/CD', 'Git'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'GCP', 'Azure'] },
    ],
    detectedRequirements: ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'scikit-learn', 'Docker', 'Git', 'REST APIs'],
  },
  'AI Engineer': {
    competencies: [
      { area: 'ML_AI', weight: 'primary', keySkills: ['Machine Learning', 'Deep Learning', 'LLMs', 'Generative AI', 'Prompt Engineering', 'Transformers', 'NLP'] },
      { area: 'BACKEND', weight: 'primary', keySkills: ['Python', 'REST APIs', 'FastAPI', 'LangChain'] },
      { area: 'DATA', weight: 'secondary', keySkills: ['Pandas', 'NumPy', 'Data Analysis', 'Feature Engineering'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'GCP', 'Azure', 'OpenAI API'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Docker', 'Git', 'MLOps'] },
    ],
    detectedRequirements: ['Python', 'LLMs', 'Generative AI', 'LangChain', 'Prompt Engineering', 'REST APIs', 'Docker', 'Git'],
  },
  'Android Developer': {
    competencies: [
      { area: 'MOBILE', weight: 'primary', keySkills: ['Android', 'Kotlin', 'Java Android', 'Jetpack Compose', 'Android SDK', 'Play Store'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['REST APIs', 'Authentication', 'Firebase'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['SQLite', 'Firebase', 'Room Database'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Android Studio', 'Gradle'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'Espresso', 'JUnit'] },
    ],
    detectedRequirements: ['Android', 'Kotlin', 'Java', 'REST APIs', 'Firebase', 'Git', 'Gradle'],
  },
  'iOS Developer': {
    competencies: [
      { area: 'MOBILE', weight: 'primary', keySkills: ['iOS', 'Swift', 'SwiftUI', 'UIKit', 'Xcode', 'App Store'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['REST APIs', 'Authentication', 'Firebase'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['Core Data', 'Firebase', 'SQLite'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Xcode', 'CocoaPods'] },
    ],
    detectedRequirements: ['iOS', 'Swift', 'SwiftUI', 'UIKit', 'REST APIs', 'Firebase', 'Git', 'Xcode'],
  },
  'Mobile App Developer': {
    competencies: [
      { area: 'MOBILE', weight: 'primary', keySkills: ['React Native', 'Flutter', 'Android', 'iOS', 'Kotlin', 'Swift', 'Dart'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['REST APIs', 'Firebase', 'Authentication'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'CI/CD'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'E2E Testing'] },
    ],
    detectedRequirements: ['React Native', 'Flutter', 'Android', 'iOS', 'REST APIs', 'Firebase', 'Git'],
  },
  'Data Engineer': {
    competencies: [
      { area: 'DATA', weight: 'primary', keySkills: ['Python', 'Spark', 'Hadoop', 'Airflow', 'ETL', 'Data Warehousing', 'SQL'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'PostgreSQL', 'MongoDB', 'Cassandra', 'DynamoDB'] },
      { area: 'CLOUD', weight: 'primary', keySkills: ['AWS', 'GCP', 'Azure', 'Redshift', 'BigQuery'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Docker', 'Kubernetes', 'Git', 'CI/CD'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Microservices', 'Event-Driven Architecture', 'Kafka'] },
    ],
    detectedRequirements: ['Python', 'Spark', 'Airflow', 'ETL', 'SQL', 'AWS', 'Docker', 'Kafka', 'Git'],
  },
  'Database Administrator': {
    competencies: [
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'Database Design', 'Query Optimization', 'Indexing', 'Transactions', 'Backup & Recovery'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Linux', 'Shell Scripting', 'Monitoring', 'Git'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS RDS', 'Azure SQL', 'Cloud Databases'] },
    ],
    detectedRequirements: ['SQL', 'MySQL', 'PostgreSQL', 'Oracle', 'Database Design', 'Query Optimization', 'Linux', 'Backup'],
  },
  'QA Engineer': {
    competencies: [
      { area: 'QA', weight: 'primary', keySkills: ['Manual Testing', 'Automated Testing', 'Test Planning', 'Test Cases', 'Bug Tracking', 'JIRA', 'Selenium', 'Cypress'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['API Testing', 'REST APIs'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'CI/CD'] },
      { area: 'TESTING', weight: 'primary', keySkills: ['Selenium', 'Cypress', 'Jest', 'JUnit', 'Performance Testing', 'Load Testing'] },
    ],
    detectedRequirements: ['Selenium', 'Cypress', 'Manual Testing', 'Automated Testing', 'JIRA', 'API Testing', 'Git', 'Test Planning'],
  },
  'Automation Test Engineer': {
    competencies: [
      { area: 'TESTING', weight: 'primary', keySkills: ['Selenium', 'Cypress', 'Playwright', 'Jest', 'TestNG', 'JUnit', 'API Testing', 'E2E Testing', 'Performance Testing'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Python', 'Java', 'JavaScript', 'REST APIs'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'CI/CD', 'Jenkins', 'Docker'] },
      { area: 'QA', weight: 'secondary', keySkills: ['Test Planning', 'Bug Tracking', 'JIRA'] },
    ],
    detectedRequirements: ['Selenium', 'Cypress', 'Python', 'Java', 'REST APIs', 'Git', 'CI/CD', 'Test Automation'],
  },
  'Cybersecurity Engineer': {
    competencies: [
      { area: 'SECURITY', weight: 'primary', keySkills: ['Cybersecurity', 'Network Security', 'OWASP', 'Penetration Testing', 'Vulnerability Assessment', 'Encryption', 'Firewall', 'SIEM'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Python', 'Bash', 'Linux'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Linux', 'Docker', 'CI/CD', 'Git'] },
      { area: 'CLOUD', weight: 'secondary', keySkills: ['AWS', 'Azure', 'Cloud Security'] },
    ],
    detectedRequirements: ['Cybersecurity', 'Network Security', 'Penetration Testing', 'OWASP', 'Encryption', 'Linux', 'Python'],
  },
  'Software Engineer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Java', 'Python', 'C#', 'REST APIs', 'Microservices', 'Authentication'] },
      { area: 'FRONTEND', weight: 'secondary', keySkills: ['JavaScript', 'HTML', 'CSS', 'React'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker', 'CI/CD', 'Linux'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'Integration Testing', 'TDD'] },
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['Design Patterns', 'SOLID Principles', 'System Design'] },
    ],
    detectedRequirements: ['Java', 'Python', 'REST APIs', 'SQL', 'Git', 'Docker', 'Unit Testing', 'System Design'],
  },
  'Software Developer': {
    competencies: [
      { area: 'BACKEND', weight: 'primary', keySkills: ['Java', 'Python', 'JavaScript', 'REST APIs', 'Authentication'] },
      { area: 'FRONTEND', weight: 'secondary', keySkills: ['HTML', 'CSS', 'JavaScript', 'React'] },
      { area: 'DATABASE', weight: 'primary', keySkills: ['SQL', 'MySQL', 'MongoDB'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Git', 'Docker'] },
      { area: 'TESTING', weight: 'secondary', keySkills: ['Unit Testing', 'Integration Testing'] },
    ],
    detectedRequirements: ['Java', 'Python', 'JavaScript', 'REST APIs', 'SQL', 'Git', 'HTML', 'CSS'],
  },
  'Solutions Architect': {
    competencies: [
      { area: 'ARCHITECTURE', weight: 'primary', keySkills: ['System Design', 'Microservices', 'Scalability', 'Design Patterns', 'Event-Driven Architecture', 'High Availability', 'Load Balancing'] },
      { area: 'CLOUD', weight: 'primary', keySkills: ['AWS', 'Azure', 'GCP', 'Cloud Architecture', 'Serverless'] },
      { area: 'BACKEND', weight: 'secondary', keySkills: ['Java', 'Python', 'REST APIs', 'Microservices'] },
      { area: 'DEVOPS', weight: 'secondary', keySkills: ['Docker', 'Kubernetes', 'Terraform', 'CI/CD'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['SQL', 'NoSQL', 'Database Design'] },
    ],
    detectedRequirements: ['System Design', 'AWS', 'Microservices', 'Scalability', 'Docker', 'Kubernetes', 'Terraform'],
  },
  'Product Manager': {
    competencies: [
      { area: 'ARCHITECTURE', weight: 'secondary', keySkills: ['System Design', 'REST APIs', 'Microservices'] },
      { area: 'DATA', weight: 'secondary', keySkills: ['SQL', 'Data Analysis', 'Power BI', 'Excel'] },
    ],
    detectedRequirements: ['SQL', 'Data Analysis', 'JIRA', 'System Design', 'REST APIs'],
  },
  'Business Analyst': {
    competencies: [
      { area: 'DATA', weight: 'primary', keySkills: ['SQL', 'Excel', 'Power BI', 'Tableau', 'Data Analysis', 'Data Visualization'] },
      { area: 'DATABASE', weight: 'secondary', keySkills: ['SQL', 'MySQL', 'Database Design'] },
    ],
    detectedRequirements: ['SQL', 'Excel', 'Power BI', 'Data Analysis', 'Tableau', 'Business Intelligence'],
  },
}

// ── Role Category List (for dropdown) ────────────────────────────────────────

export const ROLE_CATEGORIES = [
  {
    category: 'Software Development',
    roles: [
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Developer',
      'Java Developer',
      'Java Full Stack Developer',
      'Python Developer',
      'Python Full Stack Developer',
      'React Developer',
      'Node.js Developer',
      'MERN Stack Developer',
      'Angular Developer',
      'Mobile App Developer',
    ],
  },
  {
    category: 'Data & AI',
    roles: [
      'Data Analyst',
      'Data Scientist',
      'Machine Learning Engineer',
      'AI Engineer',
      'Data Engineer',
    ],
  },
  {
    category: 'Cloud & DevOps',
    roles: [
      'DevOps Engineer',
      'Cloud Engineer',
      'Site Reliability Engineer',
      'Solutions Architect',
    ],
  },
  {
    category: 'Cybersecurity',
    roles: [
      'Cybersecurity Analyst',
      'Cybersecurity Engineer',
      'Security Analyst',
    ],
  },
  {
    category: 'QA & Testing',
    roles: [
      'QA Engineer',
      'SDET',
      'Automation Test Engineer',
      'Performance Test Engineer',
    ],
  },
  {
    category: 'Product & Design',
    roles: [
      'Product Manager',
      'UI/UX Designer',
      'Business Analyst',
    ],
  },
  {
    category: 'IT & Infrastructure',
    roles: [
      'Database Administrator',
      'System Administrator',
      'Network Engineer',
    ],
  },
]

// ── Flat list for search ───────────────────────────────────────────────────────
export const ALL_ROLES = ROLE_CATEGORIES.flatMap((c) => c.roles)

// ── Experience Levels ─────────────────────────────────────────────────────────
export const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'principal', label: 'Principal' },
]

// ── Competency Match Computing ────────────────────────────────────────────────
/**
 * Compute competency-based skill gap from resume analysis data + role profile.
 *
 * @param {string[]} candidateSkillNames - flat array of canonical skill names from resume analysis
 * @param {string} roleName - selected role
 * @returns {{ competencies: Array, overallMatch: number } | null}
 */
export const computeCompetencyMatch = (candidateSkillNames, roleName) => {
  const profile = ROLE_COMPETENCY_PROFILES[roleName]
  if (!profile) return null

  const candidateSet = new Set(
    (candidateSkillNames || []).map((s) => (typeof s === 'string' ? s : s?.canonicalName || '').toLowerCase().trim())
  )

  const scored = profile.competencies.map((comp) => {
    const areaData = COMPETENCY_AREAS[comp.area]
    if (!areaData) return null

    // All skills in this competency area (broader set for partial matching)
    const areaSkillSet = new Set(areaData.skills.map((s) => s.toLowerCase().trim()))

    const matched = []
    const partial = []
    const missing = []

    for (const skill of comp.keySkills) {
      const skillLower = skill.toLowerCase().trim()

      if (candidateSet.has(skillLower)) {
        // Direct match
        matched.push(skill)
      } else {
        // Check if candidate has ANY skill from this competency area
        // (signals partial knowledge of the domain)
        const hasDomainSkill = [...candidateSet].some((cs) => areaSkillSet.has(cs))
        if (hasDomainSkill) {
          partial.push(skill)
        } else {
          missing.push(skill)
        }
      }
    }

    const total = comp.keySkills.length
    const matchScore = total > 0
      ? Math.round(((matched.length + partial.length * 0.4) / total) * 100)
      : 0

    return {
      area: comp.area,
      weight: comp.weight,
      label: areaData.label,
      icon: areaData.icon,
      keySkills: comp.keySkills,
      matched,
      partial,
      missing,
      matchPercent: Math.min(100, matchScore),
    }
  }).filter(Boolean)

  // Overall match = weighted average (primary areas count more)
  const primaryAreas = scored.filter((c) => c.weight === 'primary')
  const secondaryAreas = scored.filter((c) => c.weight === 'secondary')

  const primaryAvg = primaryAreas.length
    ? primaryAreas.reduce((sum, c) => sum + c.matchPercent, 0) / primaryAreas.length
    : 0
  const secondaryAvg = secondaryAreas.length
    ? secondaryAreas.reduce((sum, c) => sum + c.matchPercent, 0) / secondaryAreas.length
    : 0

  const overallMatch = primaryAreas.length
    ? Math.round(primaryAvg * 0.7 + secondaryAvg * 0.3)
    : Math.round(secondaryAvg)

  return {
    competencies: scored,
    overallMatch: Math.min(100, overallMatch),
    profileName: roleName,
  }
}

// ── Learning Recommendations ──────────────────────────────────────────────────
/**
 * Generate prioritized learning recommendations from competency match data.
 */
export const generateLearningRecommendations = (competencyMatch, experienceLevel = 'mid') => {
  if (!competencyMatch) return []

  const recommendations = []

  for (const comp of competencyMatch.competencies) {
    // Missing skills from PRIMARY areas → HIGH priority
    const priority = comp.weight === 'primary' ? 'high' : 'medium'

    for (const skill of comp.missing) {
      recommendations.push({
        skill,
        competency: comp.label,
        priority,
        reason: `Required for ${comp.label} — not identified in your resume.`,
      })
    }

    // Partially matched skills from primary areas → medium priority
    if (comp.weight === 'primary') {
      for (const skill of comp.partial) {
        recommendations.push({
          skill,
          competency: comp.label,
          priority: 'medium',
          reason: `You have related ${comp.label} skills but haven't demonstrated ${skill} specifically.`,
        })
      }
    }
  }

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => order[a.priority] - order[b.priority])

  return recommendations.slice(0, 8) // Max 8 recommendations
}
