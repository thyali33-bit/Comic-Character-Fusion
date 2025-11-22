
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="bg-gray-800/80 hover:bg-gray-700/80 text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
      aria-label={`Switch to ${language === 'vi' ? 'English' : 'Vietnamese'}`}
    >
      <span className={language === 'vi' ? 'text-cyan-400 font-bold' : 'text-gray-400'}>
        VI
      </span>
      <span className="mx-1 text-gray-600">/</span>
      <span className={language === 'en' ? 'text-cyan-400 font-bold' : 'text-gray-400'}>
        EN
      </span>
    </button>
  );
};

export default LanguageSwitcher;
