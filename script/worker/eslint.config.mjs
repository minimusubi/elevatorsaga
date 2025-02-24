import globals from 'globals';
import root from '../../eslint.config.mjs';

export default [...root, { languageOptions: { globals: { ...globals.worker } } }];
