// Shared Data Service for Multi-User Collaboration
import { CompanyData, OpportunityData, NoteData } from '@/utils/excelParser';
import { getAuthUserId, loadPipelineWorkspace, savePipelineWorkspace } from '@/lib/userPersistence';

export interface SharedData {
  masterPipeline: CompanyData[];
  opportunities: OpportunityData[];
  notes: NoteData[];
  lastUpdated: string;
  updatedBy: string;
}

export interface DataUpdateEvent {
  type: 'company' | 'opportunity' | 'note' | 'system';
  action: 'add' | 'update' | 'delete';
  data: any;
  userId: string;
  timestamp: string;
}

class SharedDataService {
  private static instance: SharedDataService;
  private data: SharedData;
  private listeners: Array<(event: DataUpdateEvent) => void> = [];
  private storageKey = 'gcc_shared_data';

  private constructor() {
    this.loadData();
    this.setupStorageListener();
  }

  static getInstance(): SharedDataService {
    if (!SharedDataService.instance) {
      SharedDataService.instance = new SharedDataService();
    }
    return SharedDataService.instance;
  }

  private static readonly LEGACY_EXCEL_MIGRATION_KEY = 'connecthub_legacy_excel_migration_attempted';

  private loadData(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.data = JSON.parse(stored);
      } else {
        // Initialize with empty data
        this.data = {
          masterPipeline: [],
          opportunities: [],
          notes: [],
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system'
        };
        this.saveData();
      }

      // Legacy GCC pipeline sheet — attempt once per browser if shared storage is empty.
      if (
        this.data.masterPipeline.length === 0 &&
        this.data.opportunities.length === 0 &&
        !localStorage.getItem(SharedDataService.LEGACY_EXCEL_MIGRATION_KEY)
      ) {
        localStorage.setItem(SharedDataService.LEGACY_EXCEL_MIGRATION_KEY, '1');
        void this.migrateFromExcel();
      }
    } catch (error) {
      console.error('Error loading shared data:', error);
      this.data = {
        masterPipeline: [],
        opportunities: [],
        notes: [],
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system'
      };
    }
  }

  private async migrateFromExcel(): Promise<void> {
    try {
      const excelData = await (await import('@/utils/excelParser')).loadExcelFromPublic();
      
      if (excelData && (excelData.masterPipeline.length > 0 || excelData.opportunities.length > 0)) {
        // Migrate the data to shared service
        this.data.masterPipeline = excelData.masterPipeline;
        this.data.opportunities = excelData.opportunities;
        this.data.notes = excelData.notes || [];
        this.data.lastUpdated = new Date().toISOString();
        this.data.updatedBy = 'migration';
        
        this.saveData();
        
        console.log(`✅ Migration complete: ${excelData.masterPipeline.length} companies, ${excelData.opportunities.length} opportunities, ${excelData.notes?.length || 0} notes`);
        
        // Notify listeners about the migration
        this.notifyListeners({
          type: 'system',
          action: 'update',
          data: this.data,
          userId: 'system',
          timestamp: new Date().toISOString()
        });
      }
    } catch {
      // Legacy pipeline sheet is optional — ignore quietly when absent.
    }
  }

  private saveData(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      void this.syncToDb();
      console.log('💾 Shared data saved');
    } catch (error) {
      console.error('Error saving shared data:', error);
    }
  }

  async hydrateFromDb(): Promise<void> {
    if (!getAuthUserId()) return;

    const remote = await loadPipelineWorkspace<SharedData>();
    if (!remote?.masterPipeline) {
      void this.syncToDb();
      return;
    }

    this.data = {
      masterPipeline: remote.masterPipeline || [],
      opportunities: remote.opportunities || [],
      notes: remote.notes || [],
      lastUpdated: remote.lastUpdated || new Date().toISOString(),
      updatedBy: remote.updatedBy || 'database',
    };
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    this.notifyListeners({
      type: 'system',
      action: 'update',
      data: this.data,
      userId: 'database',
      timestamp: new Date().toISOString(),
    });
  }

  private async syncToDb(): Promise<void> {
    if (!getAuthUserId()) return;
    await savePipelineWorkspace(this.data);
  }

  private setupStorageListener(): void {
    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        this.data = JSON.parse(event.newValue);
        console.log('🔄 Shared data updated from another tab');
        this.notifyListeners({
          type: 'system',
          action: 'update',
          data: this.data,
          userId: 'system',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // Public methods for data access
  getSharedData(): SharedData {
    return { ...this.data };
  }

  getCompanies(): CompanyData[] {
    return [...this.data.masterPipeline];
  }

  getOpportunities(): OpportunityData[] {
    return [...this.data.opportunities];
  }

  getNotes(): NoteData[] {
    return [...this.data.notes];
  }

  // Methods for updating data
  addCompany(company: CompanyData, userId: string): void {
    this.data.masterPipeline.push(company);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'company',
      action: 'add',
      data: company,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  updateCompany(companyId: string, updates: Partial<CompanyData>, userId: string): void {
    const index = this.data.masterPipeline.findIndex(c => c.id === companyId);
    if (index !== -1) {
      this.data.masterPipeline[index] = { ...this.data.masterPipeline[index], ...updates };
      this.updateMetadata(userId);
      this.notifyListeners({
        type: 'company',
        action: 'update',
        data: { id: companyId, ...updates },
        userId,
        timestamp: new Date().toISOString()
      });
      this.saveData();
    }
  }

  deleteCompany(companyId: string, userId: string): void {
    this.data.masterPipeline = this.data.masterPipeline.filter(c => c.id !== companyId);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'company',
      action: 'delete',
      data: { id: companyId },
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  addOpportunity(opportunity: OpportunityData, userId: string): void {
    this.data.opportunities.push(opportunity);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'opportunity',
      action: 'add',
      data: opportunity,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  updateOpportunity(opportunityId: string, updates: Partial<OpportunityData>, userId: string): void {
    const index = this.data.opportunities.findIndex(o => o.id === opportunityId);
    if (index !== -1) {
      this.data.opportunities[index] = { ...this.data.opportunities[index], ...updates };
      this.updateMetadata(userId);
      this.notifyListeners({
        type: 'opportunity',
        action: 'update',
        data: { id: opportunityId, ...updates },
        userId,
        timestamp: new Date().toISOString()
      });
      this.saveData();
    }
  }

  deleteOpportunity(opportunityId: string, userId: string): void {
    this.data.opportunities = this.data.opportunities.filter(o => o.id !== opportunityId);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'opportunity',
      action: 'delete',
      data: { id: opportunityId },
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  addNote(note: NoteData, userId: string): void {
    this.data.notes.push(note);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'note',
      action: 'add',
      data: note,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  updateNote(noteId: string, updates: Partial<NoteData>, userId: string): void {
    const index = this.data.notes.findIndex(n => n.id === noteId);
    if (index !== -1) {
      this.data.notes[index] = { ...this.data.notes[index], ...updates };
      this.updateMetadata(userId);
      this.notifyListeners({
        type: 'note',
        action: 'update',
        data: { id: noteId, ...updates },
        userId,
        timestamp: new Date().toISOString()
      });
      this.saveData();
    }
  }

  deleteNote(noteId: string, userId: string): void {
    this.data.notes = this.data.notes.filter(n => n.id !== noteId);
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'note',
      action: 'delete',
      data: { id: noteId },
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  // Bulk operations
  bulkUpdateCompanies(companies: CompanyData[], userId: string): void {
    this.data.masterPipeline = companies;
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'company',
      action: 'update',
      data: companies,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  bulkUpdateOpportunities(opportunities: OpportunityData[], userId: string): void {
    this.data.opportunities = opportunities;
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'opportunity',
      action: 'update',
      data: opportunities,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  bulkUpdateNotes(notes: NoteData[], userId: string): void {
    this.data.notes = notes;
    this.updateMetadata(userId);
    this.notifyListeners({
      type: 'note',
      action: 'update',
      data: notes,
      userId,
      timestamp: new Date().toISOString()
    });
    this.saveData();
  }

  // Event listeners for real-time updates
  subscribe(listener: (event: DataUpdateEvent) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: DataUpdateEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in data update listener:', error);
      }
    });

    // Dispatch custom event for real-time notifications
    window.dispatchEvent(new CustomEvent('dataUpdate', { detail: event }));
  }

  private updateMetadata(userId: string): void {
    this.data.lastUpdated = new Date().toISOString();
    this.data.updatedBy = userId;
  }

  // Utility methods
  clearAllData(userId: string): void {
    this.data = {
      masterPipeline: [],
      opportunities: [],
      notes: [],
      lastUpdated: new Date().toISOString(),
      updatedBy: userId
    };
    this.saveData();
    this.notifyListeners({
      type: 'system',
      action: 'update',
      data: this.data,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importData(jsonData: string, userId: string): boolean {
    try {
      const importedData = JSON.parse(jsonData);
      if (this.validateImportedData(importedData)) {
        this.data = {
          ...importedData,
          lastUpdated: new Date().toISOString(),
          updatedBy: userId
        };
        this.saveData();
        this.notifyListeners({
          type: 'system',
          action: 'update',
          data: this.data,
          userId,
          timestamp: new Date().toISOString()
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  private validateImportedData(data: any): boolean {
    return (
      data &&
      Array.isArray(data.masterPipeline) &&
      Array.isArray(data.opportunities) &&
      Array.isArray(data.notes)
    );
  }
}

export const sharedDataService = SharedDataService.getInstance();
