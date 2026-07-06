import { useState } from 'react';
import AccountsTab from './settings/AccountsTab';
import LookupTab from './settings/LookupTab';
import ShortcutsTab from './settings/ShortcutsTab';
import {
  useCategories, useSaveCategory, useDeleteCategory,
  useIncomeSources, useSaveIncomeSource, useDeleteIncomeSource,
} from '../api/hooks';

const TABS = ['Accounts', 'Categories', 'Income Sources', 'Shortcuts'] as const;
type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Accounts');

  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'Accounts' && <AccountsTab />}
        {tab === 'Categories' && (
          <LookupTab
            noun="category"
            blurb="Labels for classifying journal entries."
            useItems={useCategories}
            useSave={useSaveCategory}
            useDelete={useDeleteCategory}
          />
        )}
        {tab === 'Income Sources' && (
          <LookupTab
            noun="income source"
            blurb="Where income comes from (e.g. Employment, Interest). Attachable to income entries."
            useItems={useIncomeSources}
            useSave={useSaveIncomeSource}
            useDelete={useDeleteIncomeSource}
          />
        )}
        {tab === 'Shortcuts' && <ShortcutsTab />}
      </div>
    </div>
  );
}
