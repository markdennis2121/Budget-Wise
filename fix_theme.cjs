const fs = require('fs');
const file = 'c:/Projects/BudgetApp/src/components/AddExpenseModal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ primaryColor, textPrimary, textSecondary, backgroundColor, cardColor, dangerColor \} from '\.\.\/contexts\/ThemeContext';\n/, '');

content = content.replace(/primaryColor/g, 'theme.colors.primary');
content = content.replace(/textPrimary/g, 'theme.colors.textPrimary');
content = content.replace(/textSecondary/g, 'theme.colors.textSecondary');
content = content.replace(/backgroundColor/g, 'theme.colors.background');
content = content.replace(/cardColor/g, 'theme.colors.card');
content = content.replace(/dangerColor/g, 'theme.colors.error');

content = content.replace(/: '#FFFFFF'\)/g, `: theme.colors.inputBg)`);
content = content.replace(/: '#FFFFFF' \}/g, `: theme.colors.inputBg }`);

fs.writeFileSync(file, content);
console.log('Done');
