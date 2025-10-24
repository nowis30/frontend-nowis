import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

import { useCompanies } from '../api/companies';
import { useRoles } from '../api/roles';
import { useCreateUser, useUsers, type UserRecord } from '../api/users';
import { useCreateUserRole, useDeleteUserRole } from '../api/userRoles';

function ManageRolesDialog({
  open,
  onClose,
  user
}: {
  open: boolean;
  onClose: () => void;
  user?: UserRecord & { createdAtFormatted?: string };
}) {
  const { data: roles, isLoading: rolesLoading, isError: rolesError } = useRoles();
  const { data: companies, isLoading: companiesLoading, isError: companiesError } = useCompanies();
  const createAssignment = useCreateUserRole();
  const deleteAssignment = useDeleteUserRole();

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (!user) {
    return null;
  }

  const assignments = user.roles;
  const normalizedRoleId = selectedRoleId ? Number(selectedRoleId) : null;
  const normalizedCompanyId = selectedCompanyId ? Number(selectedCompanyId) : null;
  const busy = createAssignment.isPending || deletingId !== null;

  const resetForm = () => {
    setSelectedRoleId('');
    setSelectedCompanyId('');
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (busy) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleAdd = async () => {
    setErrorMessage(null);

    if (!normalizedRoleId) {
      setErrorMessage('Sélectionnez un rôle à attribuer.');
      return;
    }

    const existsAlready = assignments.some(
      (assignment) =>
        assignment.roleId === normalizedRoleId &&
        (assignment.companyId ?? null) === (normalizedCompanyId ?? null)
    );

    if (existsAlready) {
      setErrorMessage('Ce rôle est déjà attribué pour ce contexte.');
      return;
    }

    try {
      await createAssignment.mutateAsync({
        userId: user.id,
        roleId: normalizedRoleId,
        companyId: normalizedCompanyId ?? null
      });
      resetForm();
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setErrorMessage('Conflit : ce rôle a déjà été attribué.');
      } else {
        setErrorMessage("Impossible d'ajouter le rôle. Réessayez plus tard.");
      }
    }
  };

  const handleRemove = async (assignmentId: number) => {
    setErrorMessage(null);
    setDeletingId(assignmentId);
    try {
      await deleteAssignment.mutateAsync(assignmentId);
    } catch (error) {
      console.error(error);
      setErrorMessage('Suppression impossible. Réessayez plus tard.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Gérer les rôles</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {user.email}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ajoutez ou retirez des rôles pour cet utilisateur.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2">Rôles actuellement attribués</Typography>
          {assignments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun rôle.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {assignments.map((assignment) => (
                <Chip
                  key={assignment.id}
                  label={
                    assignment.companyName
                      ? `${assignment.roleName} · ${assignment.companyName}`
                      : `${assignment.roleName} · Global`
                  }
                  color={assignment.roleName === 'ADMIN' ? 'primary' : 'default'}
                  size="small"
                  onDelete={() => handleRemove(assignment.id)}
                  deleteIcon={
                    deletingId === assignment.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )
                  }
                  disabled={deletingId === assignment.id}
                />
              ))}
            </Box>
          )}
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2">Ajouter un rôle</Typography>
          <FormControl required error={rolesError} fullWidth>
            <InputLabel id="manage-role-select">Rôle</InputLabel>
            <Select
              labelId="manage-role-select"
              label="Rôle"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              disabled={rolesLoading || busy}
            >
              {roles?.map((role) => (
                <MenuItem key={role.id} value={String(role.id)}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {rolesError ? 'Impossible de charger les rôles.' : 'Sélectionnez le rôle à attribuer.'}
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="manage-company-select">Contexte (facultatif)</InputLabel>
            <Select
              labelId="manage-company-select"
              label="Contexte (facultatif)"
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              disabled={companiesLoading || busy}
            >
              <MenuItem value="">Global</MenuItem>
              {companies?.map((company) => (
                <MenuItem key={company.id} value={String(company.id)}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {companiesError
                ? 'Impossible de charger les sociétés.'
                : 'Laisser vide pour un rôle global.'}
            </FormHelperText>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button variant="contained" onClick={handleAdd} disabled={busy || !selectedRoleId}>
              {createAssignment.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
            {errorMessage ? <Alert severity="error" sx={{ flexGrow: 1 }}>{errorMessage}</Alert> : null}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: roles, isLoading: rolesLoading, isError: rolesError } = useRoles();
  const createUser = useCreateUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [touched, setTouched] = useState(false);

  const handleClose = () => {
    if (createUser.isPending) {
      return;
    }
    setEmail('');
    setPassword('');
    setSelectedRoles([]);
    setTouched(false);
    onClose();
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!email || !password || selectedRoles.length === 0) {
      return;
    }

    try {
      await createUser.mutateAsync({
        email,
        password,
        roles: selectedRoles.map((roleId) => ({ roleId }))
      });
      handleClose();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectRole = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    setSelectedRoles(typeof value === 'string' ? value.split(',').map(Number) : value);
  };

  const passwordHelper =
    '12 caractères minimum, incluant majuscule, minuscule, chiffre et symbole.';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Inviter un utilisateur</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <TextField
          label="Courriel"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          error={touched && !email}
        />
        <TextField
          label="Mot de passe provisoire"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          error={touched && !password}
          helperText={passwordHelper}
        />
        <FormControl required error={touched && selectedRoles.length === 0}>
          <InputLabel id="role-select-label">Rôles attribués</InputLabel>
          <Select
            labelId="role-select-label"
            multiple
            value={selectedRoles}
            label="Rôles attribués"
            onChange={handleSelectRole}
            disabled={rolesLoading || rolesError}
            renderValue={(selected) =>
              selected
                .map((roleId) => roles?.find((role) => role.id === roleId)?.name ?? roleId)
                .join(', ')
            }
          >
            {roles?.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {rolesError ? "Impossible de charger les rôles disponibles." : 'Un rôle global sera attribué par défaut.'}
          </FormHelperText>
        </FormControl>
        {createUser.isError ? (
          <Alert severity="error">Impossible de créer l'utilisateur. Vérifiez le formulaire.</Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={createUser.isPending}>
          {createUser.isPending ? 'En cours...' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TeamScreen() {
  const { data: users, isLoading, isError } = useUsers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageUserId, setManageUserId] = useState<number | null>(null);

  const rows = useMemo(() => {
    return (users ?? []).map((user) => ({
      ...user,
      createdAtFormatted: new Date(user.createdAt).toLocaleDateString('fr-CA')
    }));
  }, [users]);

  const selectedUser = manageUserId ? rows.find((user) => user.id === manageUserId) : undefined;

  if (isError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <Alert severity="error">Accès refusé ou données indisponibles.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4">Équipe et accès</Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez les utilisateurs, leurs rôles et les permissions globales de la plateforme.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setCreateDialogOpen(true)}>
          Inviter un utilisateur
        </Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Courriel</TableCell>
              <TableCell>Créé le</TableCell>
              <TableCell>Rôles attribués</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Chargement...</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Aucun utilisateur supplémentaire pour le moment.</TableCell>
              </TableRow>
            ) : (
              rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.createdAtFormatted}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {user.roles.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Aucun rôle défini
                        </Typography>
                      ) : (
                        user.roles.map((role) => (
                          <Chip
                            key={role.id}
                            label={role.companyName ? `${role.roleName} · ${role.companyName}` : `${role.roleName} · Global`}
                            color={role.roleName === 'ADMIN' ? 'primary' : 'default'}
                            size="small"
                          />
                        ))
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<ManageAccountsIcon fontSize="small" />}
                      onClick={() => setManageUserId(user.id)}
                    >
                      Gérer les rôles
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
      <CreateUserDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <ManageRolesDialog open={Boolean(manageUserId)} onClose={() => setManageUserId(null)} user={selectedUser} />
    </Box>
  );
}
