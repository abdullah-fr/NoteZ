import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Trash2, Edit3, Save, X, Search, Folder, Tag } from 'lucide-react';
import { format } from 'date-fns';

interface Note {
  id: string;
  subjectName: string;
  topicName: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      subjectName: 'Computer Science',
      topicName: 'Data Structures',
      description: 'Arrays, Linked Lists, Trees, Graphs - fundamental data structures for organizing and storing data efficiently.',
      createdAt: new Date(2025, 0, 5),
      updatedAt: new Date(2025, 0, 5),
    },
    {
      id: '2',
      subjectName: 'Mathematics',
      topicName: 'Calculus',
      description: 'Derivatives and integrals are the two main operations in calculus. Derivatives measure rate of change.',
      createdAt: new Date(2025, 0, 8),
      updatedAt: new Date(2025, 0, 10),
    },
  ]);
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    subjectName: '',
    topicName: '',
    description: '',
  });

  const filteredNotes = notes.filter(note => 
    note.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.topicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.subjectName.trim() || !formData.topicName.trim()) return;
    
    if (editingId) {
      setNotes(prev => prev.map(note => 
        note.id === editingId 
          ? { ...note, ...formData, updatedAt: new Date() }
          : note
      ));
      setEditingId(null);
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setNotes(prev => [newNote, ...prev]);
    }
    
    setFormData({ subjectName: '', topicName: '', description: '' });
    setShowForm(false);
  };

  const handleEdit = (note: Note) => {
    setFormData({
      subjectName: note.subjectName,
      topicName: note.topicName,
      description: note.description,
    });
    setEditingId(note.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ subjectName: '', topicName: '', description: '' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          Notes
        </h2>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" /> New Note
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="pl-10 bg-muted/30 border-border/50"
        />
      </div>
      
      {/* Add/Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                {editingId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingId ? 'Edit Note' : 'Create New Note'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    Subject Name
                  </label>
                  <div className="relative">
                    <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formData.subjectName}
                      onChange={(e) => setFormData(prev => ({ ...prev, subjectName: e.target.value }))}
                      placeholder="e.g., Computer Science"
                      className="pl-10 bg-muted/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    Topic Name
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formData.topicName}
                      onChange={(e) => setFormData(prev => ({ ...prev, topicName: e.target.value }))}
                      placeholder="e.g., Data Structures"
                      className="pl-10 bg-muted/30"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Write your notes here..."
                  className="min-h-[120px] bg-muted/30"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" /> {editingId ? 'Update' : 'Save'} Note
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Notes grid */}
      {filteredNotes.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No notes match your search' : 'No notes yet. Create your first note!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative"
            >
              <div className="glass rounded-2xl p-6 h-full border border-transparent hover:border-primary/30 transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium">
                        {note.subjectName}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{note.topicName}</h3>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(note)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">
                  {note.description}
                </p>
                
                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/30 pt-4 mt-auto">
                  <span>Created: {format(note.createdAt, 'MMM d, yyyy')}</span>
                  {note.updatedAt.getTime() !== note.createdAt.getTime() && (
                    <span>Updated: {format(note.updatedAt, 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
