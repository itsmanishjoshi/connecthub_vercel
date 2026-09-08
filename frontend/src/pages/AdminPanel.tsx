import { useState, useEffect } from 'react';
import { useAuth } from '@/context/SimpleAuthContext';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow } from '@/components/AppRibbon';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserPlus, MoreVertical, RefreshCw, CheckCircle2, XCircle, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { passwordError } from '@/lib/passwordRules';
import { downloadAdminUserData } from '@/services/adminUserDataService';

interface UserData {
  id: string;
  username: string;
  email: string;
  status: 'initialized' | 'onboarding' | 'active' | 'dead';
  password_changed: boolean;
  password_changed_at: string | null;
  last_login_at: string | null;
  created_at: string;
  profile: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    profile_completed: boolean;
  } | null;
}

export default function AdminPanel() {
  const {
    isAdmin,
    getAllUsers,
    addUser,
    deleteUser,
    updateUsername,
    updateUserEmail,
    changeUserPassword,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const backTarget =
    (location.state as { from?: string } | null)?.from || '/settings?tab=users';

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Add user dialog
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Edit dialogs
  const [editUsernameDialogOpen, setEditUsernameDialogOpen] = useState(false);
  const [editEmailDialogOpen, setEditEmailDialogOpen] = useState(false);
  const [editPasswordDialogOpen, setEditPasswordDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error('Username and temporary password are required');
      return;
    }

    const problem = passwordError(newPassword);
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await addUser(newUsername.trim().toLowerCase(), newEmail.trim(), newPassword);
      toast.success('Account created. They will set their own password on first login.');
      setAddUserDialogOpen(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const handleEditUsername = async () => {
    if (!selectedUser || !editValue.trim()) {
      toast.error('Username is required');
      return;
    }

    try {
      await updateUsername(selectedUser.id, editValue);
      toast.success('Username updated successfully!');
      setEditUsernameDialogOpen(false);
      setEditValue('');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update username');
    }
  };

  const handleEditEmail = async () => {
    if (!selectedUser || !editValue.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      await updateUserEmail(selectedUser.id, editValue);
      toast.success('Email updated successfully!');
      setEditEmailDialogOpen(false);
      setEditValue('');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update email');
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !editValue || !confirmValue) {
      toast.error('Both password fields are required');
      return;
    }

    if (editValue !== confirmValue) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await changeUserPassword(selectedUser.id, editValue);
      toast.success('Password reset. They will choose a new password on next login.');
      setEditPasswordDialogOpen(false);
      setEditValue('');
      setConfirmValue('');
      loadUsers();
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteUser(selectedUser.id);
      toast.success('User deleted successfully!');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleExportUserData = async (user: UserData) => {
    try {
      await downloadAdminUserData(user.id, 'md');
      toast.success(`Exported data for ${user.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const handleViewUserData = (user: UserData) => {
    navigate(`/admin/users/${user.id}/data`, { state: { from: '/admin', adminFrom: backTarget } });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      initialized: { variant: 'secondary', label: 'Initialized', color: 'bg-gray-500' },
      onboarding: { variant: 'default', label: 'Onboarding', color: 'bg-blue-500' },
      active: { variant: 'default', label: 'Active', color: 'bg-green-500' },
      dead: { variant: 'destructive', label: 'Dead', color: 'bg-red-500' },
    };

    const config = variants[status] || variants.initialized;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="app-page min-h-screen bg-background">
      {/* Header */}
      <AppRibbonBar>
        <AppRibbonRow>
          <div className="min-w-0 flex-1">
            <AppRibbonBrand title="Admin" leading="back" onLeadingClick={() => navigate(backTarget)} />
          </div>
          <div className="responsive-toolbar shrink-0">
            <Button variant="outline" onClick={loadUsers} disabled={loading} className="h-9 text-sm">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => setAddUserDialogOpen(true)} className="h-9 text-sm">
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add User</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </AppRibbonRow>
      </AppRibbonBar>

      {/* Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl">User Management</CardTitle>
            <CardDescription className="text-sm">
              Create logins, reset passwords, and remove accounts. People set their own password on first login.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
            ) : (
              <div className="responsive-table-scroll mobile-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Username</TableHead>
                      <TableHead className="min-w-[180px]">Email</TableHead>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[150px]">Company</TableHead>
                      <TableHead className="min-w-[100px]">Password</TableHead>
                      <TableHead className="min-w-[100px]">Profile</TableHead>
                      <TableHead className="min-w-[150px]">Last Login</TableHead>
                      <TableHead className="text-right min-w-[80px] sticky right-0 bg-card">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="font-medium text-sm responsive-text-wrap">{user.username}</TableCell>
                        <TableCell className="text-xs sm:text-sm responsive-text-wrap">{user.email || '-'}</TableCell>
                        <TableCell className="text-sm responsive-text-wrap">
                          {user.profile
                            ? `${user.profile.first_name} ${user.profile.last_name}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{user.profile?.company || '-'}</TableCell>
                        <TableCell>
                          {user.password_changed ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="text-xs">Changed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-600">
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="text-xs">Initial</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.profile?.profile_completed ? (
                            <Badge variant="default" className="text-xs">Complete</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Incomplete</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(user.last_login_at)}
                        </TableCell>
                        <TableCell className="text-right sticky right-0 bg-card">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUserData(user)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View data
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportUserData(user)}>
                                <Download className="mr-2 h-4 w-4" />
                                Export
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditValue(user.username);
                                  setEditUsernameDialogOpen(true);
                                }}
                              >
                                Edit Username
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditValue(user.email);
                                  setEditEmailDialogOpen(true);
                                }}
                              >
                                Edit Email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditValue('');
                                  setConfirmValue('');
                                  setEditPasswordDialogOpen(true);
                                }}
                              >
                                Change Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                Delete Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>
              Create a login like john.paul. They sign in with this username, choose their own password, then complete their profile. You can still reset or remove the account later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                placeholder="john.paul"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, dots, or underscores.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email (optional)</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">They must change it on first login.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Username Dialog */}
      <Dialog open={editUsernameDialogOpen} onOpenChange={setEditUsernameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              Change username for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">New Username</Label>
              <Input
                id="edit-username"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUsernameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUsername}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={editEmailDialogOpen} onOpenChange={setEditEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
            <DialogDescription>
              Change email for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">New Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditEmail}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={editPasswordDialogOpen} onOpenChange={setEditPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedUser?.username}"? This will soft-delete the account and mark it as deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
