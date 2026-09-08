import readXlsxFile, { type Sheet } from 'read-excel-file/browser';

export interface CompanyData {
  id: string;
  companyName: string;
  industry: string;
  decisionMaker: string;
  designation: string;
  city: string;
  revenue: string;
  email: string;
  contact: string;
  linkedin: string;
  stage: string;
  connection: string;
  lastActivity: string;
  nextAction: string;
  category: string;
  useCase: string;
  value: string;
  progress: number;
  remark: string; // Single remark field for notes
}

export interface OpportunityData {
  id: string;
  sn: string;
  opportunity: string;
  client: string;
  poc: string;
  opportunityType: string;
  remark: string;
  actionPlan: string;
  status: string;
  amount: string;
  details: string;
}

export interface NoteData {
  id: string;
  content: string;
  timestamp: string;
  category?: string;
  tags?: string[];
  priority?: string;
}

export interface ExcelData {
  masterPipeline: CompanyData[];
  opportunities: OpportunityData[];
  notes: NoteData[];
}

const parseStage = (stage: string): string => {
  const stageMap: { [key: string]: string } = {
    'identified': 'Identified',
    'researched': 'Researched', 
    'outreach initiated': 'Outreach Initiated',
    'engaged / lead': 'Engaged',
    'qualified opportunity': 'Qualified Opportunity',
    'active opportunity': 'Active Opportunity',
    'closed - won': 'Closed Won',
    'closed - lost': 'Closed Lost'
  };
  return stageMap[stage.toLowerCase()] || stage;
};

const parseConnection = (connection: string): string => {
  const connectionMap: { [key: string]: string } = {
    'not connected': 'Not Connected',
    'linkedin connected': 'LinkedIn Connected',
    'email sent': 'Email Sent',
    'responded': 'Responded',
    'meeting setup': 'Meeting Setup',
    'meeting done': 'Meeting Done'
  };
  return connectionMap[connection.toLowerCase()] || connection;
};

const getCellValue = (row: any, possibleKeys: string[]): string => {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]);
    }
  }
  return '';
};

const getNumberValue = (row: any, possibleKeys: string[]): number => {
  const value = getCellValue(row, possibleKeys);
  if (!value) return 0;
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

const rowsToObjects = (data: Sheet['data']): Record<string, unknown>[] => {
  if (data.length < 2) return [];
  const headers = data[0].map((value) => String(value || '').trim());
  return data.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]]))
  );
};

const findSheet = (workbook: Sheet[], names: string[]) => {
  const wanted = names.map((name) => name.toLowerCase());
  return workbook.find((sheet) => wanted.includes(sheet.sheet.toLowerCase()));
};

const parseWorkbook = (workbook: Sheet[]): ExcelData => {
  const result: ExcelData = {
    masterPipeline: [],
    opportunities: [],
    notes: []
  };

  // Parse Master Pipeline sheet
  const masterSheet = findSheet(workbook, ['Master', 'Master Pipeline']);
  if (masterSheet) {
    console.log('Parsing Master sheet...');
    const masterData = rowsToObjects(masterSheet.data);
    console.log('Master data rows:', masterData.length);
    
    result.masterPipeline = masterData.map((row: any, index: number) => {
      const company: CompanyData = {
        id: `company-${index}`,
        companyName: getCellValue(row, ['company name', 'companyName', 'company', 'Company Name']),
        industry: getCellValue(row, ['industry', 'Industry']),
        decisionMaker: getCellValue(row, ['Decision Makers', 'decision maker', 'decisionMaker', 'Decision Maker', 'Decision maker', 'DM', 'Contact Person', 'Contact', 'Owner', 'Account Owner', 'Sales Rep', 'Manager']),
        designation: getCellValue(row, ['designation', 'Designation', 'title', 'Title']),
        city: getCellValue(row, ['city', 'City', 'location', 'Location']),
        revenue: getCellValue(row, ['revenue', 'Revenue', 'Revenue (USD)', 'Annual Revenue']),
        email: getCellValue(row, ['email', 'Email', 'Email Address']),
        contact: getCellValue(row, ['contact', 'Contact', 'Phone', 'Mobile']),
        linkedin: getCellValue(row, ['linkedin', 'LinkedIn', 'LinkedIn Profile']),
        stage: parseStage(getCellValue(row, ['stage', 'Stage', 'Status', 'Pipeline Stage'])),
        connection: parseConnection(getCellValue(row, ['connection', 'Connection', 'Connection Status'])),
        lastActivity: getCellValue(row, ['last activity', 'lastActivity', 'Last Activity', 'Last Contact']),
        nextAction: getCellValue(row, ['next action', 'nextAction', 'Next Action', 'Next Step']),
        category: getCellValue(row, ['category', 'Category', 'Type', 'Segment']),
        useCase: getCellValue(row, ['use case', 'useCase', 'Use Case', 'Solution']),
        value: getCellValue(row, ['value', 'Value', 'Priority', 'Deal Value']),
        progress: getNumberValue(row, ['progress', 'Progress', 'Completion', '%']),
        remark: getCellValue(row, ['remark', 'Remark', 'Notes', 'Comments']) // Only read single remark column
      };
      
      console.log(`Parsed company ${index + 1}:`, company.companyName);
      return company;
    });
  } else {
    console.warn('Master sheet not found. Available sheets:', workbook.map((sheet) => sheet.sheet));
  }

  // Parse Opportunities sheet
  const opportunitiesSheet = findSheet(workbook, ['Opportunities']);
  if (opportunitiesSheet) {
    console.log('Parsing Opportunities sheet...');
    const oppData = rowsToObjects(opportunitiesSheet.data);
    console.log('Opportunities data rows:', oppData.length);
    
    result.opportunities = oppData.map((row: any, index: number) => ({
      id: `opp-${index}`,
      sn: getCellValue(row, ['SN', 'S.No', 'Serial No', 'ID']),
      opportunity: getCellValue(row, ['opportunity', 'Opportunity', 'Project', 'Deal']),
      client: getCellValue(row, ['client', 'Client', 'Company', 'Account']),
      poc: getCellValue(row, ['poc', 'POC', 'Point of Contact', 'Contact Person']),
      opportunityType: getCellValue(row, ['opportunity type', 'opportunityType', 'Type', 'Category']),
      remark: getCellValue(row, ['remark 1', 'Remark 1', 'remark1', 'Remark1', 'quick note', 'Quick Note', 'note', 'Note']),
      actionPlan: getCellValue(row, ['action plan', 'actionPlan', 'Action Plan', 'Next Steps']),
      status: getCellValue(row, ['status', 'Status', 'State', 'Stage']),
      amount: getCellValue(row, ['amount', 'Amount', 'Value', 'Deal Size']),
      details: getCellValue(row, ['details', 'Details', 'Description', 'Scope'])
    }));
  }

  // Parse Notebook sheet
  const notebookSheet = findSheet(workbook, ['Notebook', 'Notes']);
  if (notebookSheet) {
    console.log('Parsing Notebook sheet...');
    const notesData = rowsToObjects(notebookSheet.data);
    console.log('Notes data rows:', notesData.length);
    
    result.notes = notesData.map((row: any, index: number) => ({
      id: `note-${index}`,
      content: getCellValue(row, ['content', 'Content', 'note', 'Note', 'description', 'Description']),
      timestamp: getCellValue(row, ['timestamp', 'Timestamp', 'date', 'Date', 'created', 'Created']),
      category: getCellValue(row, ['category', 'Category', 'type', 'Type', 'tag', 'Tag']) || 'General'
    }));
  }

  console.log('Final parsed data:', {
    companies: result.masterPipeline.length,
    opportunities: result.opportunities.length,
    notes: result.notes.length
  });

  return result;
};

export const loadExcelFromPublic = async (): Promise<ExcelData> => {
  const empty: ExcelData = {
    masterPipeline: [],
    opportunities: [],
    notes: [],
  };

  try {
    const response = await fetch('/GCC_Master_Pipeline.xlsx');
    if (!response.ok) {
      return empty;
    }

    const arrayBuffer = await response.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 2));
    // XLSX files are ZIP archives — reject HTML/404 bodies that break the parser.
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      return empty;
    }

    const workbook = await readXlsxFile(new Blob([arrayBuffer]));
    return parseWorkbook(workbook);
  } catch {
    return empty;
  }
};
