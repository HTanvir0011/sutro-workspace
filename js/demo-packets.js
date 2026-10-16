/*
 * Three hand-written demo packets. ALL DATA IS SYNTHETIC: every person, place,
 * khatian number, deed number and office below is invented for demonstration.
 * There is no generator and no hidden answer key: the engine sees only these documents.
 */
(function (root) {
  'use strict';

  const karimBase = () => ([
    {
      id: 'k-sa87', type: 'khatian', survey: 'SA', khatianNo: '87', year: 1962, dag: '310', area: '100',
      owners: [{ name: 'Karim', share: '1' }], provenance: 'certified'
    },
    {
      id: 'h-karim', type: 'heirCert', decedent: 'Karim', deathYear: 1985,
      religion: 'muslim', school: 'hanafi', will: 'unknown', issuer: 'Union Parishad (synthetic)',
      heirs: [
        { name: 'Amena', relation: 'wife', status: 'survived', childrenSurvived: '', statedShare: '' },
        { name: 'Rahim', relation: 'son', status: 'survived', childrenSurvived: '', statedShare: '' },
        { name: 'Salim', relation: 'son', status: 'survived', childrenSurvived: '', statedShare: '' },
        { name: 'Rokeya', relation: 'daughter', status: 'survived', childrenSurvived: '', statedShare: '' }
      ],
      provenance: 'certified'
    },
    {
      id: 'k-bs512', type: 'khatian', survey: 'BS', khatianNo: '512', year: 1998, dag: '1203', area: '100',
      owners: [{ name: 'Rahim', share: '1/2' }, { name: 'Salim', share: '1/2' }], provenance: 'seller_copy'
    }
  ]);

  const PACKETS = [
    {
      id: 'demo-a',
      synthetic: true,
      title: { en: "A · Seller's packet (Rahim)", bn: 'ক · বিক্রেতার কাগজপত্র (রহিম)' },
      blurb: {
        en: 'What the seller handed over: an SA khatian, the heir certificate and a BS khatian.',
        bn: 'বিক্রেতা যা দিয়েছেন: এসএ খতিয়ান, ওয়ারিশ সনদ ও বিএস খতিয়ান।'
      },
      asOfYear: 2026,
      plot: { mouza: 'Shantipur (synthetic)', jl: '45', dags: { SA: '310', BS: '1203' } },
      offer: { seller: 'Rahim', area: '50', basisKhatian: 'BS-512' },
      docs: karimBase()
    },
    {
      id: 'demo-b',
      synthetic: true,
      title: { en: 'B · After a registry search (Rahim)', bn: 'খ · তল্লাশির পর (রহিম)' },
      blurb: {
        en: 'The buyer obtained a registry search for 2005–2015 and a certified copy of the deed it lists.',
        bn: 'ক্রেতা ২০০৫–২০১৫ সালের তল্লাশি এবং তাতে পাওয়া দলিলের সার্টিফায়েড কপি সংগ্রহ করেছেন।'
      },
      asOfYear: 2026,
      plot: { mouza: 'Shantipur (synthetic)', jl: '45', dags: { SA: '310', BS: '1203' } },
      offer: { seller: 'Rahim', area: '50', basisKhatian: 'BS-512' },
      docs: karimBase().concat([
        {
          id: 's-2005', type: 'search', fromYear: 2005, toYear: 2015, dag: '1203',
          office: 'Sub-Registry Office (synthetic)', deedsFound: '4417/2011', provenance: 'certified'
        },
        {
          id: 'd-4417', type: 'deed', deedNo: '4417/2011', year: 2011, dag: '1203',
          sellers: [{ name: 'Rahim', area: '20' }], buyers: [{ name: 'Farid', area: '20' }],
          basisKhatian: 'BS-512', previousDeeds: '', provenance: 'certified'
        }
      ])
    },
    {
      id: 'demo-c',
      synthetic: true,
      title: { en: 'C · Predeceased son (Jamal)', bn: 'গ · পূর্বমৃত পুত্র (জামাল)' },
      blurb: {
        en: "Kamal died before his father. Whether he left surviving children is not stated. Try changing that field.",
        bn: 'কামাল তার পিতার আগে মারা গেছেন। তার জীবিত সন্তান ছিল কিনা উল্লেখ নেই। ঘরটি পরিবর্তন করে দেখুন।'
      },
      asOfYear: 2026,
      plot: { mouza: 'Nayagram (synthetic)', jl: '12', dags: { RS: '245', BS: '877' } },
      offer: { seller: 'Jamal', area: '20', basisKhatian: 'BS-641' },
      docs: [
        {
          id: 'k-rs33', type: 'khatian', survey: 'RS', khatianNo: '33', year: 1980, dag: '245', area: '60',
          owners: [{ name: 'Hasan', share: '1' }], provenance: 'certified'
        },
        {
          id: 'h-hasan', type: 'heirCert', decedent: 'Hasan', deathYear: 2001,
          religion: 'muslim', school: 'hanafi', will: 'no', issuer: 'Pourashava (synthetic)',
          heirs: [
            { name: 'Laila', relation: 'wife', status: 'survived', childrenSurvived: '', statedShare: '' },
            { name: 'Jamal', relation: 'son', status: 'survived', childrenSurvived: '', statedShare: '' },
            { name: 'Nasrin', relation: 'daughter', status: 'survived', childrenSurvived: '', statedShare: '' },
            { name: 'Kamal', relation: 'son', status: 'predeceased', childrenSurvived: 'unknown', statedShare: '' }
          ],
          provenance: 'certified'
        },
        {
          id: 'k-bs641', type: 'khatian', survey: 'BS', khatianNo: '641', year: 2008, dag: '877', area: '60',
          owners: [{ name: 'Laila', share: '1/8' }, { name: 'Jamal', share: '7/12' }, { name: 'Nasrin', share: '7/24' }],
          provenance: 'certified'
        },
        {
          id: 's-1980', type: 'search', fromYear: 1980, toYear: 2026, dag: '',
          office: 'Sub-Registry Office (synthetic)', deedsFound: '', provenance: 'certified'
        }
      ]
    }
  ];

  const api = { DEMO_PACKETS: PACKETS };
  root.Sutro = Object.assign(root.Sutro || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
