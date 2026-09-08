import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Tag, Calendar, Target, User, Building, FileText, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MyWorkNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNote: (content: string, category?: string, tags?: string[], priority?: string) => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General', icon: FileText },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'task', label: 'Task', icon: Target },
  { value: 'person', label: 'Person', icon: User },
  { value: 'company', label: 'Company', icon: Building },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const QUICK_TEMPLATES = [
  'Follow up with client about proposal',
  'Schedule meeting with team',
  'Review project requirements',
  'Prepare presentation for stakeholders',
  'Update project status',
  'Contact decision maker',
  'Send follow-up email',
  'Research competitor information',
];

export const MyWorkNoteModal = ({
  open,
  onOpenChange,
  onAddNote,
}: MyWorkNoteModalProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTemplateSelect = (template: string) => {
    setContent(template);
    setSelectedTemplate(template);
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({
        title: "⚠️ Empty Note",
        description: "Please enter some content for your note.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    onAddNote(content.trim(), category, tags, priority);
    
    // Reset form
    setContent('');
    setCategory('general');
    setPriority('medium');
    setTags([]);
    setTagInput('');
    setSelectedTemplate('');
    onOpenChange(false);
    
    toast({
      title: "✅ Private Note Added",
      description: "Your private note has been successfully added.",
      duration: 2000,
    });
  };

  const handleClose = () => {
    setContent('');
    setCategory('general');
    setPriority('medium');
    setTags([]);
    setTagInput('');
    setSelectedTemplate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-popover">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Private Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title and Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title" className="text-sm font-medium mb-2 block">
                Title *
              </Label>
              <Input
                id="title"
                placeholder="Enter note title..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-medium"
              />
            </div>
            <div>
              <Label htmlFor="priority" className="text-sm font-medium mb-2 block">
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((pri) => (
                    <SelectItem key={pri.value} value={pri.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${pri.color}`} />
                        {pri.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category and Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-sm font-medium mb-2 block">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate" className="text-sm font-medium mb-2 block">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                className="w-full"
              />
            </div>
          </div>

          {/* Main Content */}
          <div>
            <Label htmlFor="content" className="text-sm font-medium mb-2 block">
              Note Content *
            </Label>
            <Textarea
              id="content"
              placeholder="Enter your detailed note here..."
              className="min-h-[150px] resize-none"
            />
          </div>

          {/* Additional Fields Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="relatedTo" className="text-sm font-medium mb-2 block">
                Related To (Company/Person)
              </Label>
              <Input
                id="relatedTo"
                placeholder="e.g., ABC Corp, John Doe"
              />
            </div>
            <div>
              <Label htmlFor="actionItem" className="text-sm font-medium mb-2 block">
                Action Item
              </Label>
              <Input
                id="actionItem"
                placeholder="e.g., Follow up call, Send proposal"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags" className="text-sm font-medium mb-2 block">
              Tags
            </Label>
            <div className="flex gap-2 mb-2">
              <Input
                id="tags"
                placeholder="Add tags..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent('Meeting with ' + (tagInput || 'client') + ' - ' + new Date().toLocaleDateString());
                setCategory('meeting');
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Quick Meeting Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent('Follow up with ' + (tagInput || 'contact') + ' regarding ');
                setCategory('task');
                setPriority('high');
              }}
            >
              <Target className="h-4 w-4 mr-2" />
              Quick Follow Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent('Call ' + (tagInput || 'contact') + ' - ');
                setCategory('call');
              }}
            >
              <Phone className="h-4 w-4 mr-2" />
              Quick Call Note
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!content.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Private Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
