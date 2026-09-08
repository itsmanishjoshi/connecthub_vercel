import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  Handshake,
  Phone,
  Mail,
  Calendar,
  Tag,
  User,
  Users,
  Building,
  Target,
  FileText,
  Download,
  Upload,
  Star,
  AlertCircle,
  XCircle,
  Eye,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { notebookService, MeetingNote } from '@/services/notebookService';
import { CompanyData } from '@/utils/excelParser';
import NotebookNoteModal from '@/components/NotebookNoteModal';

interface NotebookProps {
  companies: CompanyData[];
}

const Notebook = ({ companies }: NotebookProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<MeetingNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [expandedNote, setExpandedNote] = useState<MeetingNote | null>(null);
  const [isEditingExpanded, setIsEditingExpanded] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [companySuggestions, setCompanySuggestions] = useState<CompanyData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [stickyNote, setStickyNote] = useState('');
  const maxWords = 100;

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [newNote, setNewNote] = useState<Partial<MeetingNote>>({
    title: '',
    content: '',
    type: 'note',
    category: 'general',
    priority: 'medium',
    participants: [],
    tags: [],
    metadata: {}
  });

  const getLinkedParticipants = (participants: string[] | undefined, participantSource?: 'list' | 'free') => {
    const list = (participants || []).map(p => p.trim()).filter(Boolean);

    // Only auto-link when participant was selected from suggestions list.
    // Backward compatibility: if no source stored, keep linking behavior.
    if (participantSource === 'free') {
      // For free-form participants, only show what was actually entered, not linked pairs
      return { pairs: [] as Array<{ company: string; person?: string }>, others: list };
    }

    const companyToDm = new Map<string, string>();
    const dmToCompany = new Map<string, string>();
    for (const c of companies) {
      if (c.companyName) {
        companyToDm.set(c.companyName, c.decisionMaker || '');
      }
      if (c.decisionMaker) {
        dmToCompany.set(c.decisionMaker, c.companyName || '');
      }
    }

    const pairs: Array<{ company: string; person?: string }> = [];
    const others: string[] = [];
    const seen = new Set<string>();

    for (const p of list) {
      if (companyToDm.has(p)) {
        const person = companyToDm.get(p) || undefined;
        const key = `${p}::${person || ''}`;
        if (!seen.has(key)) {
          pairs.push({ company: p, person });
          seen.add(key);
        }
        continue;
      }

      if (dmToCompany.has(p)) {
        const company = dmToCompany.get(p) || '';
        const key = `${company}::${p}`;
        if (!seen.has(key)) {
          pairs.push({ company: company || p, person: company ? p : undefined });
          seen.add(key);
        }
        continue;
      }

      if (!others.includes(p)) others.push(p);
    }

    return { pairs, others };
  };

  const getParticipantBadgeClass = (kind: 'company' | 'person' | 'other', hasDecisionMaker?: boolean) => {
    switch (kind) {
      case 'company':
        return hasDecisionMaker ? 'text-white dark:text-white' : 'text-blue-700 dark:text-blue-300';
      case 'person':
        return hasDecisionMaker ? 'text-green-700 dark:text-green-300' : 'text-white dark:text-white';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  // Get all unique decision makers from companies
  const getDecisionMakers = (): string[] => {
    const decisionMakers = new Set<string>();
    companies.forEach(company => {
      if (company.decisionMaker) {
        decisionMakers.add(company.decisionMaker);
      }
    });
    return Array.from(decisionMakers).sort();
  };

  // Get all unique company names
  const getCompanyNames = (): string[] => {
    return companies.map(c => c.companyName).sort();
  };

  // Get all participants (companies + decision makers)
  const getAllParticipants = (): string[] => {
    const participants = new Set<string>();
    getCompanyNames().forEach(name => participants.add(name));
    getDecisionMakers().forEach(name => participants.add(name));
    return Array.from(participants).sort();
  };

  useEffect(() => {
    const loadNotes = () => {
      const allNotes = notebookService.getNotes();
      setNotes(allNotes);
      setFilteredNotes(allNotes);
    };

    loadNotes();

    const unsubscribe = notebookService.subscribe((updatedNotes) => {
      setNotes(updatedNotes);
      applyFilters(updatedNotes);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyFilters(notes);
  }, [notes, searchQuery, selectedType, selectedPriority]);

  const applyFilters = (notesToFilter: MeetingNote[]) => {
    let filtered = notesToFilter;

    // Search filter
    if (searchQuery) {
      filtered = notebookService.searchNotes(searchQuery);
    } else {
      filtered = notesToFilter;
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(note => note.type === selectedType);
    }

    // Priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(note => note.priority === selectedPriority);
    }

    setFilteredNotes(filtered);
  };

  const handleAddNote = () => {
    if (!newNote.title?.trim() || !newNote.content?.trim()) {
      toast({
        title: "⚠️ Missing Information",
        description: "Please provide both title and content for the note.",
        variant: "destructive",
      });
      return;
    }

    // Create related entity based on company input
    let relatedEntity = null;
    if (selectedCompany) {
      const company = companies.find(c => c.companyName === selectedCompany);
      relatedEntity = {
        type: 'company',
        name: selectedCompany,
        id: company?.id || selectedCompany.toLowerCase().replace(/\s+/g, '-')
      };
    }

    const currentUser = JSON.parse(localStorage.getItem('gcc_user') || '{}');
    const note = notebookService.addNote({
      title: newNote.title || '',
      content: newNote.content || '',
      type: newNote.type as MeetingNote['type'],
      category: newNote.category as MeetingNote['category'],
      priority: newNote.priority as MeetingNote['priority'],
      status: 'draft',
      participants: [selectedCompany], // Use selected company as participant
      tags: newNote.tags || [],
      metadata: newNote.metadata || {},
      relatedEntity,
      createdBy: currentUser.username || 'anonymous'
    });

    setNewNote({
      title: '',
      content: '',
      type: 'note',
      category: 'general',
      priority: 'medium',
      participants: [],
      tags: [],
      metadata: {}
    });
    setSelectedCompany('');
    setCompanyInput('');
    setShowSuggestions(false);

    setIsAddingNote(false);

    toast({
      title: "✅ Note Added",
      description: `"${note.title}" has been saved to notebook.`,
    });
  };

  const handleEditNote = (note: MeetingNote) => {
    setEditingNote(note);
    setNewNote({
      title: note.title,
      content: note.content,
      type: note.type,
      category: note.category,
      priority: note.priority,
      participants: note.participants,
      tags: note.tags,
      metadata: note.metadata
    });
    setIsAddingNote(true);
  };

  const handleUpdateNote = () => {
    if (!editingNote) return;

    const currentUser = JSON.parse(localStorage.getItem('gcc_user') || '{}');
    notebookService.updateNote(editingNote.id, {
      title: newNote.title,
      content: newNote.content,
      type: newNote.type,
      category: newNote.category,
      priority: newNote.priority,
      status: editingNote.status,
      participants: newNote.participants,
      tags: newNote.tags,
      metadata: newNote.metadata
    });

    setEditingNote(null);
    setIsAddingNote(false);
    setNewNote({
      title: '',
      content: '',
      type: 'note',
      category: 'general',
      priority: 'medium',
      participants: [],
      tags: [],
      metadata: {}
    });

    toast({
      title: "✅ Note Updated",
      description: `"${editingNote.title}" has been updated.`,
    });
  };

  const handleDeleteNote = (noteId: string, noteTitle: string) => {
    setDeleteConfirm({ id: noteId, title: noteTitle });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    notebookService.deleteNote(deleteConfirm.id);
    toast({
      title: "✅ Note Deleted",
      description: `"${deleteConfirm.title}" has been deleted.`,
    });
    setDeleteConfirm(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleExpandNote = (note: MeetingNote) => {
    setExpandedNote(note);
    setIsEditingExpanded(false);
    setEditingContent(note.content);
  };

  const handleCloseExpandedNote = () => {
    setExpandedNote(null);
    setIsEditingExpanded(false);
    setEditingContent('');
  };

  const handleEditExpandedNote = () => {
    setIsEditingExpanded(true);
    setEditingContent(expandedNote?.content || '');
  };

  const handleSaveExpandedNote = () => {
    if (!expandedNote) return;
    
    const updatedNote = { ...expandedNote, content: editingContent };
    notebookService.updateNote(expandedNote.id, updatedNote);
    
    setExpandedNote(updatedNote);
    setIsEditingExpanded(false);
    
    toast({
      title: "✅ Note Updated",
      description: `"${expandedNote.title}" has been updated successfully.`,
    });
  };

  // Company autocomplete logic
  const handleCompanyInputChange = (value: string) => {
    setCompanyInput(value);
    setSelectedCompany(value);
    
    if (value.length >= 2) {
      // Filter companies based on input (fuzzy search)
      const filtered = companies.filter(company => 
        company.companyName.toLowerCase().includes(value.toLowerCase()) ||
        company.industry.toLowerCase().includes(value.toLowerCase()) ||
        company.city.toLowerCase().includes(value.toLowerCase())
      );
      setCompanySuggestions(filtered.slice(0, 5)); // Show max 5 suggestions
      setShowSuggestions(true);
    } else {
      setCompanySuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleCompanySelect = (company: CompanyData) => {
    setCompanyInput(company.companyName);
    setSelectedCompany(company.companyName);
    setShowSuggestions(false);
    setCompanySuggestions([]);
  };

  const handleCompanyBlur = () => {
    // Hide suggestions after a short delay to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleCancelEditExpanded = () => {
    setIsEditingExpanded(false);
    setEditingContent(expandedNote?.content || '');
  };

  const getTypeColor = (type: string) => {
    const colors = {
      meeting: 'bg-blue-100 text-blue-800',
      call: 'bg-green-100 text-green-800',
      email: 'bg-purple-100 text-purple-800',
      note: 'bg-gray-100 text-gray-800',
      research: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || colors.note;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      meeting: '🤝',
      call: '📞',
      email: '📧',
      note: '📝',
      research: '🔍',
    };
    return icons[type as keyof typeof icons] || '📝';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getPriorityGlowClass = (priority: string) => {
    const glows = {
      low: 'text-gray-700 drop-shadow-[0_0_6px_rgba(156,163,175,0.5)]',
      medium: 'text-yellow-700 drop-shadow-[0_0_6px_rgba(202,138,4,0.5)]',
      high: 'text-orange-700 drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]',
      urgent: 'text-red-700 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]'
    };
    return glows[priority as keyof typeof glows] || glows.medium;
  };

  const exportNotes = () => {
    const data = notebookService.exportNotes();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcc-notebook-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "📤 Notes Exported",
      description: "Notebook has been exported successfully.",
    });
  };

  const handleSaveNote = (noteData: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    const noteWithCreator = {
      ...noteData,
      createdBy: 'current-user', // In real app, this would come from auth context
    };
    
    if (editingNote) {
      notebookService.updateNote(editingNote.id, noteWithCreator);
      toast({
        title: "✅ Note Updated",
        description: `"${noteData.title}" has been updated successfully.`,
      });
    } else {
      notebookService.addNote(noteWithCreator);
      toast({
        title: "📝 Note Added",
        description: `"${noteData.title}" has been added successfully.`,
      });
    }
    setEditingNote(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                📝 Meeting Notebook
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Capture meeting notes, action items, and follow-ups with rich metadata
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportNotes} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => {
                setEditingNote(null);
                setIsNoteModalOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Main Content */}
          <div className="flex-1">

        {/* Filters */}
        <Card className="mb-4 w-full max-w-3xl">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="meeting">🤝 Meeting</SelectItem>
                    <SelectItem value="call">📞 Call</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="note">📝 Note</SelectItem>
                    <SelectItem value="research">🔍 Research</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className={`hover:shadow-lg transition-shadow ${
                note.priority === 'low' ? 'border-l border-gray-400' :
                note.priority === 'medium' ? 'border-l border-yellow-400' :
                note.priority === 'high' ? 'border-l border-orange-400' :
                note.priority === 'urgent' ? 'border-l border-red-500' :
                ''
              }`}>
              <CardHeader className="pb-2 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium line-clamp-2 mb-2">{note.title}</CardTitle>
                    <div className="flex items-center gap-0.5 mt-1 flex-wrap">
                      <div className="text-lg font-bold">
                        {getTypeIcon(note.type)}
                      </div>
                      <div className="text-xs font-medium capitalize">
                        {note.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNote(note);
                        setIsNoteModalOpen(true);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id, note.title)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 p-3">
                <CardDescription 
                  className="text-xs mb-1 line-clamp-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors -mt-4"
                  onClick={() => handleExpandNote(note)}
                >
                  {note.content}
                </CardDescription>
                
                {note.participants && note.participants.length > 0 && (
                  <div className="mb-2">
                    {(() => {
                      const { pairs, others } = getLinkedParticipants(note.participants, note.metadata?.participantSource);
                      const firstPair = pairs[0];
                      const shownOthers = others.slice(0, 1);
                      const remaining = Math.max(0, (pairs.length > 0 ? pairs.length - 1 : 0) + Math.max(0, others.length - shownOthers.length));

                      return (
                        <div className="space-y-1">
                          {firstPair ? (
                            <>
                              <div className="flex items-center gap-1">
                                <div className={`flex items-center gap-1 text-xs truncate ${getParticipantBadgeClass('company', firstPair.company && getDecisionMakers().includes(firstPair.company))}`}>
                                  <Building className="w-3 h-3" />
                                  <span className="truncate">{firstPair.company}</span>
                                </div>
                              </div>
                              {firstPair.person && (
                                <div className="flex items-center gap-1">
                                  <div className={`flex items-center gap-1 text-xs truncate ${getParticipantBadgeClass('person', firstPair.person && getDecisionMakers().includes(firstPair.person))}`}>
                                    <User className="w-3 h-3" />
                                    <span className="truncate">{firstPair.person}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            shownOthers.map((p, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <Badge className={`text-xs truncate ${getParticipantBadgeClass('other')}`}>
                                  <Users className="w-3 h-3 mr-1" />
                                  {p}
                                </Badge>
                              </div>
                            ))
                          )}

                          {remaining > 0 && (
                            <div className="text-xs text-gray-500">+{remaining} more</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Tag className="w-2 h-2 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-xs text-gray-500">+{note.tags.length - 2}</span>
                    )}
                  </div>
                )}

                {note.date && note.time && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {note.date} {note.time}
                      {note.duration ? ` (${note.duration})` : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredNotes.length === 0 && (
          <div className="flex items-center justify-center">
            <Card className="text-center py-8 px-6 w-full max-w-lg">
              <CardContent className="space-y-3">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <CardTitle className="text-lg mb-2">No Notes Found</CardTitle>
                <CardDescription className="text-sm">
                  {searchQuery 
                    ? `No notes found matching "${searchQuery}"`
                    : 'No notes in your notebook yet. Start by adding your first note!'
                  }
                </CardDescription>
                {!searchQuery && (
                  <Button onClick={() => setIsNoteModalOpen(true)} className="mt-3" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Note
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
          </div>

          {/* Sticky Note Sidebar */}
          <div className="w-96 flex-shrink-0">
            <div className="bg-yellow-100 dark:bg-gray-800 border-2 border-yellow-300 dark:border-gray-600 rounded-lg p-4 shadow-lg sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Quick Notes
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStickyNote('')}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              
              <Textarea
                value={stickyNote}
                onChange={(e) => {
                  const text = e.target.value;
                  if (countWords(text) <= maxWords) {
                    setStickyNote(text);
                  }
                }}
                placeholder="Click to type your quick notes..."
                className="min-h-[300px] resize-none bg-yellow-50 dark:bg-gray-700 border-yellow-200 dark:border-gray-500 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:ring-offset-0"
              />
              
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-right">
                {countWords(stickyNote)} / {maxWords} words
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Note Modal */}
      {expandedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-auto m-4 left-[calc(50%-4mm)] translate-x-[-50%] relative">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{expandedNote.title}</h3>
                <div className="flex items-center gap-0.25 mt-0.5 flex-wrap">
                  <div className="text-lg font-bold">
                    {getTypeIcon(expandedNote.type)}
                  </div>
                  <div className="text-xs font-medium capitalize">
                    {expandedNote.type}
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleCloseExpandedNote}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                {expandedNote.date && expandedNote.time && (
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {expandedNote.date} {expandedNote.time}
                      {expandedNote.duration ? ` (${expandedNote.duration})` : ''}
                    </span>
                  </div>
                )}
                
                {expandedNote.participants && expandedNote.participants.length > 0 && (
                  <div className="mb-3">
                    <span className="text-sm font-medium">Participants: </span>
                    <div className="mt-2 space-y-2">
                      {(() => {
                        const { pairs, others } = getLinkedParticipants(expandedNote.participants, expandedNote.metadata?.participantSource);
                        return (
                          <>
                            {pairs.map((p, idx) => (
                              <div key={`pair-${idx}`} className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Building className="w-4 h-4 mr-2" />
                                  <span className="truncate">{p.company}</span>
                                </div>
                                {p.person && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-4 h-4 mr-2" />
                                    <span className="truncate">{p.person}</span>
                                  </div>
                                )}
                              </div>
                            ))}

                            {others.map((o, idx) => (
                              <Badge key={`other-${idx}`} className={`w-fit text-sm ${getParticipantBadgeClass('other')}`}>
                                <Users className="w-4 h-4 mr-2" />
                                <span className="truncate">{o}</span>
                              </Badge>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {expandedNote.relatedEntity && (
                  <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="flex items-center gap-2">
                      {expandedNote.relatedEntity.type === 'company' && <Building className="w-4 h-4" />}
                      {expandedNote.relatedEntity.type === 'person' && <User className="w-4 h-4" />}
                      {expandedNote.relatedEntity.type === 'opportunity' && <Target className="w-4 h-4" />}
                      <span className="text-sm font-medium">
                        Related: {expandedNote.relatedEntity.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mb-4">
                {isEditingExpanded ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[200px] resize-none"
                      placeholder="Edit note content..."
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleCancelEditExpanded}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveExpandedNote}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {expandedNote.content}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleEditExpandedNote}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Note
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {expandedNote.tags.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Tags:</div>
                  <div className="flex flex-wrap gap-1">
                    {expandedNote.tags.map((tag, index) => (
                      <Badge key={index} className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {expandedNote.metadata.actionItems && expandedNote.metadata.actionItems.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">📋 Action Items:</div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                    <ul className="text-sm space-y-2">
                      {expandedNote.metadata.actionItems.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {expandedNote.metadata.keyDecisions && expandedNote.metadata.keyDecisions.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">🎯 Key Decisions:</div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                    <ul className="text-sm space-y-2">
                      {expandedNote.metadata.keyDecisions.map((decision, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></span>
                          {decision}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notebook Note Modal */}
      <NotebookNoteModal
        open={isNoteModalOpen}
        onOpenChange={setIsNoteModalOpen}
        note={editingNote}
        companies={companies}
        onSave={handleSaveNote}
      />

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm
                ? `This will permanently delete "${deleteConfirm.title}".`
                : 'This will permanently delete the note.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Notebook;
