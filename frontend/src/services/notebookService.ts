// Notebook Service for Meeting Notes and Metadata
import { CompanyData, OpportunityData, NoteData } from '@/utils/excelParser';
import { getAuthUserId, loadUserRows, replaceUserRows } from '@/lib/userPersistence';

export interface MeetingNote {
  id: string;
  title: string;
  content: string;
  type: 'meeting' | 'call' | 'email' | 'note' | 'research';
  category: 'person' | 'company' | 'opportunity' | 'general';
  relatedEntity?: {
    type: 'company' | 'person' | 'opportunity';
    id: string;
    name: string;
  };
  participants: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent' | '';
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Calendar integration fields
  date?: string; // YYYY-MM-DD format
  time?: string; // HH:MM format
  duration?: string; // e.g., '1h', '30m'
  location?: string;
  metadata: {
    duration?: string;
    location?: string;
    participantSource?: 'list' | 'free';
    nextAction?: string;
    followUpRequired?: boolean;
    followUpDate?: string;
    actionItems?: string[];
    keyDecisions?: string[];
    outcomes?: string;
  };
}

export interface NotebookData {
  notes: MeetingNote[];
  lastSynced: string;
  version: string;
}

class NotebookService {
  private static instance: NotebookService;
  private data: NotebookData;
  private listeners: Array<(notes: MeetingNote[]) => void> = [];
  private storageKey = 'gcc_notebook_data';

  private constructor() {
    this.loadData();
    this.setupStorageListener();
  }

  static getInstance(): NotebookService {
    if (!NotebookService.instance) {
      NotebookService.instance = new NotebookService();
    }
    return NotebookService.instance;
  }

  private loadData(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.data = JSON.parse(stored);
      } else {
        this.data = {
          notes: [],
          lastSynced: new Date().toISOString(),
          version: '1.0.0'
        };
        this.saveData();
      }
    } catch (error) {
      console.error('Error loading notebook data:', error);
      this.data = {
        notes: [],
        lastSynced: new Date().toISOString(),
        version: '1.0.0'
      };
    }
  }

  private saveData(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      void this.syncToDb();
      console.log('📝 Notebook data saved');
    } catch (error) {
      console.error('Error saving notebook data:', error);
    }
  }

  async hydrateFromDb(): Promise<void> {
    if (!getAuthUserId()) return;

    const rows = await loadUserRows<Record<string, unknown>>('meeting_notes', {
      column: 'updated_at',
      ascending: false,
    });
    if (!rows.length) {
      void this.syncToDb();
      return;
    }

    this.data = {
      notes: rows.map((row) => this.rowToNote(row)),
      lastSynced: new Date().toISOString(),
      version: '1.0.0',
    };
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    this.notifyListeners(this.data.notes);
  }

  private async syncToDb(): Promise<void> {
    if (!getAuthUserId()) return;
    await replaceUserRows('meeting_notes', this.data.notes.map((note) => this.noteToRow(note)));
  }

  private noteToRow(note: MeetingNote): Record<string, unknown> {
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      type: note.type,
      category: note.category,
      related_entity: note.relatedEntity || null,
      participants: note.participants,
      tags: note.tags,
      priority: note.priority,
      status: note.status,
      note_date: note.date || null,
      note_time: note.time || null,
      duration: note.duration || null,
      location: note.location || null,
      metadata: note.metadata,
      created_by: note.createdBy,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    };
  }

  private rowToNote(row: Record<string, unknown>): MeetingNote {
    return {
      id: String(row.id),
      title: String(row.title),
      content: String(row.content || ''),
      type: (row.type as MeetingNote['type']) || 'note',
      category: (row.category as MeetingNote['category']) || 'general',
      relatedEntity: row.related_entity as MeetingNote['relatedEntity'],
      participants: Array.isArray(row.participants) ? row.participants as string[] : [],
      tags: Array.isArray(row.tags) ? row.tags as string[] : [],
      priority: (row.priority as MeetingNote['priority']) || '',
      status: (row.status as MeetingNote['status']) || 'draft',
      date: row.note_date ? String(row.note_date) : undefined,
      time: row.note_time ? String(row.note_time) : undefined,
      duration: row.duration ? String(row.duration) : undefined,
      location: row.location ? String(row.location) : undefined,
      metadata: (row.metadata as MeetingNote['metadata']) || {},
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        this.data = JSON.parse(event.newValue);
        console.log('🔄 Notebook data updated from another tab');
        this.notifyListeners(this.data.notes);
      }
    });
  }

  // Public methods
  getNotes(): MeetingNote[] {
    return [...this.data.notes];
  }

  getNotesByEntity(entityType: 'company' | 'person' | 'opportunity', entityId: string): MeetingNote[] {
    return this.data.notes.filter(note => 
      note.relatedEntity && 
      note.relatedEntity.type === entityType && 
      note.relatedEntity.id === entityId
    );
  }

  getNotesByTag(tag: string): MeetingNote[] {
    return this.data.notes.filter(note => 
      note.tags.includes(tag)
    );
  }

  getNotesByType(type: MeetingNote['type']): MeetingNote[] {
    return this.data.notes.filter(note => note.type === type);
  }

  addNote(note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>): MeetingNote {
    const newNote: MeetingNote = {
      ...note,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.notes.push(newNote);
    this.data.lastSynced = new Date().toISOString();
    this.saveData();
    this.notifyListeners(this.data.notes);

    console.log('📝 Note added:', newNote.title);
    return newNote;
  }

  updateNote(noteId: string, updates: Partial<MeetingNote>): MeetingNote | null {
    const index = this.data.notes.findIndex(n => n.id === noteId);
    if (index === -1) return null;

    this.data.notes[index] = {
      ...this.data.notes[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.data.lastSynced = new Date().toISOString();
    this.saveData();
    this.notifyListeners(this.data.notes);

    console.log('✏️ Note updated:', this.data.notes[index].title);
    return this.data.notes[index];
  }

  deleteNote(noteId: string): boolean {
    const index = this.data.notes.findIndex(n => n.id === noteId);
    if (index === -1) return false;

    const deletedNote = this.data.notes[index];
    this.data.notes.splice(index, 1);
    this.data.lastSynced = new Date().toISOString();
    this.saveData();
    this.notifyListeners(this.data.notes);

    console.log('🗑️ Note deleted:', deletedNote.title);
    return true;
  }

  // Search and filter methods
  searchNotes(query: string): MeetingNote[] {
    const searchTerm = query.toLowerCase();
    return this.data.notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      (note.relatedEntity && note.relatedEntity.name.toLowerCase().includes(searchTerm))
    );
  }

  getRecentNotes(limit: number = 10): MeetingNote[] {
    return this.data.notes
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  getHighPriorityNotes(): MeetingNote[] {
    return this.data.notes.filter(note => 
      note.priority === 'high' || note.priority === 'urgent'
    );
  }

  getFollowUpRequired(): MeetingNote[] {
    return this.data.notes.filter(note => 
      note.metadata.followUpRequired && 
      (!note.metadata.followUpDate || new Date(note.metadata.followUpDate) <= new Date())
    );
  }

  // Utility methods
  subscribe(listener: (notes: MeetingNote[]) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(notes: MeetingNote[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(notes);
      } catch (error) {
        console.error('Error in notebook listener:', error);
      }
    });
  }

  // Export/Import methods
  exportNotes(): string {
    return JSON.stringify({
      ...this.data,
      exportedAt: new Date().toISOString(),
      exportedBy: JSON.parse(localStorage.getItem('gcc_user') || '{}')?.username || 'unknown'
    }, null, 2);
  }

  importNotes(jsonData: string): boolean {
    try {
      const importedData = JSON.parse(jsonData);
      if (this.validateImportedData(importedData)) {
        this.data = {
          notes: importedData.notes || [],
          lastSynced: new Date().toISOString(),
          version: '1.0.0'
        };
        this.saveData();
        this.notifyListeners(this.data.notes);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing notes:', error);
      return false;
    }
  }

  private validateImportedData(data: any): boolean {
    return (
      data &&
      Array.isArray(data.notes) &&
      data.notes.every((note: any) => 
        note.title && 
        note.content && 
        note.createdBy
      )
    );
  }

  // Generate summary for quick reference
  generatePersonSummary(personName: string): any {
    const personNotes = this.getNotesByEntity('person', personName);
    
    if (personNotes.length === 0) return null;

    const recentNotes = personNotes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const actionItems = personNotes
      .flatMap(note => note.metadata.actionItems || [])
      .filter(item => item.trim());

    const keyDecisions = personNotes
      .flatMap(note => note.metadata.keyDecisions || [])
      .filter(item => item.trim());

    return {
      personName,
      totalNotes: personNotes.length,
      recentActivity: recentNotes.map(note => ({
        date: note.createdAt,
        type: note.type,
        title: note.title,
        summary: note.content.substring(0, 100) + '...'
      })),
      pendingActionItems: actionItems,
      keyDecisions,
      lastInteraction: personNotes[0]?.createdAt,
      meetingHistory: personNotes.filter(note => note.type === 'meeting' || note.type === 'call')
    };
  }

  generateCompanySummary(companyId: string): any {
    const companyNotes = this.getNotesByEntity('company', companyId);
    
    if (companyNotes.length === 0) return null;

    const opportunities = companyNotes.filter(note => note.category === 'opportunity');
    const meetings = companyNotes.filter(note => note.type === 'meeting');

    return {
      companyId,
      totalNotes: companyNotes.length,
      opportunities: opportunities.map(note => ({
        title: note.title,
        description: note.content,
        priority: note.priority,
        nextAction: note.metadata.nextAction,
        followUpDate: note.metadata.followUpDate
      })),
      recentMeetings: meetings
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map(note => ({
          date: note.createdAt,
          title: note.title,
          participants: note.participants,
          keyDecisions: note.metadata.keyDecisions,
          actionItems: note.metadata.actionItems
        }))
    };
  }
}

export const notebookService = NotebookService.getInstance();
