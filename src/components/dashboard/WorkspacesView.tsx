import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import {
  fetchWorkspaces,
  createWorkspace,
  fetchMembers,
  fetchMemberProfiles,
  inviteMember,
  changeMemberRole,
  removeMember,
  PENDING_USER,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
  type MemberProfile,
} from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Users, Plus, UserPlus, Trash2, Crown, Shield, Edit3, Eye, Copy, LogOut,
} from 'lucide-react';


const ROLE_META: Record<WorkspaceRole, { icon: any; color: string; label: string }> = {
  owner: { icon: Crown, color: 'text-amber-400', label: 'Owner' },
  admin: { icon: Shield, color: 'text-primary', label: 'Admin' },
  editor: { icon: Edit3, color: 'text-emerald-400', label: 'Editor' },
  viewer: { icon: Eye, color: 'text-muted-foreground', label: 'Viewer' },
};

export default function WorkspacesView() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');

  const active = useMemo(() => workspaces.find(w => w.id === activeId) || null, [workspaces, activeId]);
  const myRole: WorkspaceRole | null = useMemo(() => {
    if (!user || !active) return null;
    const me = members.find(m => m.user_id === user.id);
    return (me?.role as WorkspaceRole) || null;
  }, [user, active, members]);
  const canAdmin = myRole === 'owner' || myRole === 'admin';

  useEffect(() => { loadWorkspaces(); }, [user?.id]);
  useEffect(() => { if (activeId) loadMembersData(activeId); }, [activeId]);

  async function loadWorkspaces() {
    if (!user) return;
    setLoading(true);
    const data = await fetchWorkspaces();
    setWorkspaces(data);
    if (data.length && !activeId) setActiveId(data[0].id);
    setLoading(false);
  }

  async function loadMembersData(wsId: string) {
    const list = await fetchMembers(wsId);
    setMembers(list);
    const ids = list.map(m => m.user_id).filter(id => id !== PENDING_USER);
    const profs = await fetchMemberProfiles(ids);
    const map: Record<string, { full_name: string | null; email: string | null }> = {};
    profs.forEach((p: MemberProfile) => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
    setProfiles(map);
  }

  async function createWorkspaceHandler() {
    if (!user || !newName.trim()) return;
    const data = await createWorkspace(user.id, newName);
    setWorkspaces(prev => [data, ...prev]);
    setActiveId(data.id);
    setNewName('');
    setCreateOpen(false);
    toast({ title: 'Workspace created', description: data.name });
  }

  async function inviteMemberHandler() {
    if (!active || !inviteEmail.trim()) return;
    const { isPending } = await inviteMember(active.id, inviteEmail, inviteRole);
    toast({
      title: isPending ? 'Invitation pending' : 'Member added',
      description: isPending
        ? `${inviteEmail} will join when they sign up`
        : `${inviteEmail} now has access`,
    });
    setInviteEmail('');
    setInviteOpen(false);
    loadMembersData(active.id);
  }

  async function changeRoleHandler(memberId: string, role: WorkspaceRole) {
    await changeMemberRole(memberId, role);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  }

  async function removeMemberHandler(m: WorkspaceMember) {
    await removeMember(m.id);
    setMembers(prev => prev.filter(x => x.id !== m.id));
  }

  async function leaveWorkspace() {
    if (!user || !active) return;
    const me = members.find(m => m.user_id === user.id);
    if (!me) return;
    if (myRole === 'owner') {
      toast({ title: 'Owners cannot leave', description: 'Transfer ownership or delete the workspace instead.' });
      return;
    }
    await removeMember(me.id);
    setActiveId(null);
    loadWorkspaces();
  }

  function copyInviteLink() {
    if (!active) return;
    const link = `${window.location.origin}/signup?workspace=${active.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied', description: 'Share with your teammate' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">Collaborate with classmates and teammates</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New workspace</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>Give your workspace a name. You'll be the owner.</DialogDescription>
            </DialogHeader>
            <Input placeholder="e.g. Bio 101 Study Group" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createWorkspaceHandler} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : workspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-purple flex items-center justify-center mx-auto mb-3 shadow-glow">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              Create a shared space to study with classmates, share sources, and chat with the same AI context.
            </p>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create workspace</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          {/* List */}
          <div className="space-y-2">
            {workspaces.map(w => (
              <button
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  activeId === w.id
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/60 bg-card/40 hover:bg-card/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{w.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.created_by === user?.id ? 'Owner' : 'Member'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          {active && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{active.name}</CardTitle>
                    <CardDescription>
                      {members.length} member{members.length === 1 ? '' : 's'} · You are <span className="text-foreground font-medium">{myRole ? ROLE_META[myRole].label : '—'}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={copyInviteLink}>
                      <Copy className="h-4 w-4" /> Invite link
                    </Button>
                    {canAdmin && (
                      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><UserPlus className="h-4 w-4" /> Invite</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite teammate</DialogTitle>
                            <DialogDescription>They'll get access when they sign in.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <Input
                              type="email"
                              placeholder="teammate@email.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin — manage members</SelectItem>
                                <SelectItem value="editor">Editor — create & edit</SelectItem>
                                <SelectItem value="viewer">Viewer — read only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                            <Button onClick={inviteMemberHandler} disabled={!inviteEmail.trim()}>Send invite</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {myRole && myRole !== 'owner' && (
                      <Button variant="ghost" size="sm" onClick={leaveWorkspace}>
                        <LogOut className="h-4 w-4" /> Leave
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {members.map(m => {
                      const meta = ROLE_META[m.role];
                      const Icon = meta.icon;
                      const profile = profiles[m.user_id];
                      const pending = m.user_id === PENDING_USER;
                      const display = pending
                        ? m.invited_email
                        : profile?.full_name || profile?.email || 'Member';
                      const initials = (display || 'M').slice(0, 2).toUpperCase();
                      const isMe = user?.id === m.user_id;
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/30">
                          <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center text-xs font-semibold">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {display} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Icon className={`h-3 w-3 ${meta.color}`} />
                              <span>{meta.label}</span>
                              {pending && <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">Pending</Badge>}
                            </div>
                          </div>
                          {canAdmin && m.role !== 'owner' && !isMe && (
                            <>
                              <Select value={m.role} onValueChange={(v) => changeRoleHandler(m.id, v as WorkspaceRole)}>
                                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="editor">Editor</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" onClick={() => removeMemberHandler(m)} aria-label="Remove">
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}