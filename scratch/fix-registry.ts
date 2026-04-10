import fs from 'fs';
const path = 'lib/email-template-registry.ts';
const content = fs.readFileSync(path, 'utf8');

// Pattern to find the loop that overwrites templates
const loopPattern = /\/\/ Update existing system templates[\s\S]*for \(const template of SYSTEM_EMAIL_TEMPLATES\) \{[\s\S]*?\}\s*?\}/;

if (loopPattern.test(content)) {
    const newContent = content.replace(loopPattern, '// Update existing templates removed\n}');
    fs.writeFileSync(path, newContent);
    console.log('Successfully removed the auto-overwrite loop.');
} else {
    console.log('Pattern not found.');
}
