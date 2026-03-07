import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Configuration
const TARGET_DIR = path.join(process.cwd(), 'app');
const FILE_PATTERN = '**/*.tsx';
const IGNORE_PATTERNS = ['**/node_modules/**', '**/.next/**'];

// Regex patterns to detect risky code
const PATTERNS = [
  {
    name: 'Inline Async Server Action in Form',
    regex: /<form[^>]*action=\{async\s*[^}]*\}/g,
    message: 'Detected inline async function in form action. This may cause "Functions cannot be passed directly to Client Components" error if passed to a client component. Use a named Server Action or wrap with "use server".',
    severity: 'error'
  },
  {
    name: 'Server Action Passed to Client Component Prop',
    regex: /<[A-Z][a-zA-Z0-9]*[^>]*\s+[a-z]+=\{async\s*[^}]*\}/g,
    message: 'Detected async function passed as prop to a component. If the target is a Client Component, this will fail. Ensure the function is a Server Action or the component handles it correctly.',
    severity: 'warning'
  }
];

function scanFiles() {
  console.log(`🔍 Scanning for risky Server Action patterns in ${TARGET_DIR}...\n`);

  glob(FILE_PATTERN, { cwd: TARGET_DIR, ignore: IGNORE_PATTERNS, absolute: true }).then((files) => {

    let errorCount = 0;
    let warningCount = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(process.cwd(), file);
      
      PATTERNS.forEach(pattern => {
        let match;
        // Reset regex state
        pattern.regex.lastIndex = 0;
        
        while ((match = pattern.regex.exec(content)) !== null) {
          const lines = content.substring(0, match.index).split('\n');
          const lineNum = lines.length;
          
          if (pattern.severity === 'error') errorCount++;
          else warningCount++;

          console.log(`[${pattern.severity.toUpperCase()}] ${relativePath}:${lineNum}`);
          console.log(`   ${pattern.message}`);
          console.log(`   Match: ${match[0].substring(0, 100)}...`); // Truncate long matches
          console.log('---');
        }
      });
    });

    console.log(`\nScan complete.`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Warnings: ${warningCount}`);

    if (errorCount > 0) {
      console.log('\n❌ Potential runtime errors detected. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ No critical issues found.');
    }
  });
}

scanFiles();
