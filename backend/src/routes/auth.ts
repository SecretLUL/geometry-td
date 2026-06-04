import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { authenticateUser, JWT_SECRET } from '../auth';
import { AuthenticatedRequest } from '../types';

export const authRouter = Router();

authRouter.post('/auth/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Ungültige Eingabedaten' });
    return;
  }
  
  const trimmedUser = username.trim();
  if (trimmedUser.length < 4 || trimmedUser.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
    res.status(400).json({ error: 'Benutzername muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.' });
    return;
  }
  
  if (password.length < 8) {
    res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    return;
  }
  
  try {
    const existing = await db.oneOrNone('SELECT id FROM users WHERE username = $1', [trimmedUser]);
    if (existing) {
      res.status(400).json({ error: 'Benutzername ist bereits vergeben.' });
      return;
    }
    
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    await db.tx(async t => {
      const newUser = await t.one(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
        [trimmedUser, passwordHash]
      );
      await t.none(
        'INSERT INTO progress (user_id, highest_wave, unlocked_skins, unlocked_achievements, selected_skin) VALUES ($1, 0, $2, $3, $4)',
        [newUser.id, JSON.stringify(['default']), JSON.stringify([]), 'default']
      );
    });
    
    res.status(201).json({ success: true, message: 'Registrierung erfolgreich.' });
  } catch (error) {
    console.error('[AUTH] Fehler bei Registrierung:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password, remember } = req.body;
  
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Ungültige Eingabedaten' });
    return;
  }
  
  try {
    const user = await db.oneOrNone('SELECT id, username, password_hash, avatar, created_at FROM users WHERE username = $1', [username.trim()]);
    if (!user) {
      res.status(400).json({ error: 'Ungültiger Benutzername oder Passwort.' });
      return;
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Ungültiger Benutzername oder Passwort.' });
      return;
    }
    
    const isRemember = remember === true;
    const jwtExpires = isRemember ? '30d' : '24h';
    const cookieMaxAge = isRemember ? 30 * 24 * 60 * 60 * 1000 : undefined;
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: jwtExpires });
    
    const isProd = process.env.NODE_ENV === 'production';
    const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
    
    res.cookie(cName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      ...(cookieMaxAge !== undefined ? { maxAge: cookieMaxAge } : {}),
      path: '/'
    });
    
    res.json({ success: true, user: { id: user.id, username: user.username, avatar: user.avatar, created_at: user.created_at } });
  } catch (error) {
    console.error('[AUTH] Fehler bei Login:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.post('/auth/logout', (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
  res.clearCookie(cName, { path: '/' });
  res.json({ success: true });
});

authRouter.get('/auth/me', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const user = await db.oneOrNone('SELECT id, username, avatar, created_at FROM users WHERE id = $1', [authReq.user!.id]);
    if (!user) {
      res.status(401).json({ error: 'Benutzer nicht gefunden' });
      return;
    }
    res.json({ user: { id: user.id, username: user.username, avatar: user.avatar, created_at: user.created_at } });
  } catch (err) {
    console.error('[AUTH] Fehler bei /api/auth/me:', err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.get('/user/progress', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const progress = await db.oneOrNone(
      'SELECT highest_wave, unlocked_skins, unlocked_achievements, selected_skin FROM progress WHERE user_id = $1',
      [authReq.user!.id]
    );
    if (!progress) {
      res.status(404).json({ error: 'Fortschritt nicht gefunden.' });
      return;
    }
    res.json({ progress });
  } catch (error) {
    console.error('[PROGRESS] Fehler beim Laden:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.post('/user/progress', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { selected_skin } = req.body;
  
  if (selected_skin && typeof selected_skin !== 'string') {
    res.status(400).json({ error: 'Ungültiges Format für selected_skin' });
    return;
  }
  
  try {
    if (selected_skin) {
      const progress = await db.one('SELECT unlocked_skins FROM progress WHERE user_id = $1', [authReq.user!.id]);
      const unlocked = progress.unlocked_skins || [];
      if (!unlocked.includes(selected_skin)) {
        res.status(400).json({ error: 'Dieser Skin ist noch nicht freigeschaltet.' });
        return;
      }
      
      await db.none('UPDATE progress SET selected_skin = $1, updated_at = NOW() WHERE user_id = $2', [selected_skin, authReq.user!.id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PROGRESS] Fehler beim Speichern:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.post('/user/unlock-achievement', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { achievementId } = req.body;
  
  if (!achievementId || typeof achievementId !== 'string') {
    res.status(400).json({ error: 'Ungültige Errungenschafts-ID.' });
    return;
  }

  try {
    const progress = await db.oneOrNone('SELECT unlocked_achievements FROM progress WHERE user_id = $1', [authReq.user!.id]);
    if (!progress) {
      res.status(404).json({ error: 'Fortschritt nicht gefunden.' });
      return;
    }

    const achievements: string[] = progress.unlocked_achievements || [];
    
    if (achievements.includes(achievementId)) {
      res.json({ success: true, alreadyUnlocked: true });
      return;
    }

    achievements.push(achievementId);

    await db.none(
      'UPDATE progress SET unlocked_achievements = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(achievements), authReq.user!.id]
    );

    res.json({ success: true, newlyUnlocked: true });
  } catch (error) {
    console.error('[ACHIEVEMENT] Fehler beim Freischalten:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.post('/user/profile', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { username, avatar } = req.body;
  
  try {
    const userId = authReq.user!.id;
    let newUsername = authReq.user!.username;
    
    if (username !== undefined) {
      if (typeof username !== 'string') {
        res.status(400).json({ error: 'Ungültiger Benutzernamens-Typ.' });
        return;
      }
      const trimmedUser = username.trim();
      if (trimmedUser.length < 4 || trimmedUser.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
        res.status(400).json({ error: 'Benutzername muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.' });
        return;
      }
      
      const existing = await db.oneOrNone('SELECT id FROM users WHERE username = $1 AND id != $2', [trimmedUser, userId]);
      if (existing) {
        res.status(400).json({ error: 'Benutzername ist bereits vergeben.' });
        return;
      }
      newUsername = trimmedUser;
    }
    
    if (avatar !== undefined) {
      if (avatar !== null && typeof avatar !== 'string') {
        res.status(400).json({ error: 'Ungültiger Avatar-Typ.' });
        return;
      }
      if (avatar !== null) {
        if (avatar.length > 700000) {
          res.status(400).json({ error: 'Profilbild darf nicht größer als 500 KB sein.' });
          return;
        }
        if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(avatar)) {
          res.status(400).json({ error: 'Ungültiges Bildformat. Nur PNG, JPEG, GIF und WEBP sind erlaubt.' });
          return;
        }
      }
    }
    
    await db.tx(async t => {
      if (username !== undefined) {
        await t.none('UPDATE users SET username = $1 WHERE id = $2', [newUsername, userId]);
      }
      if (avatar !== undefined) {
        await t.none('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
      }
    });
    
    if (username !== undefined) {
      const token = jwt.sign({ id: userId, username: newUsername }, JWT_SECRET, { expiresIn: '7d' });
      const isProd = process.env.NODE_ENV === 'production';
      const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
      
      res.cookie(cName, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
    }
    
    const user = await db.one('SELECT created_at FROM users WHERE id = $1', [userId]);
    res.json({ success: true, user: { id: userId, username: newUsername, avatar: avatar !== undefined ? avatar : undefined, created_at: user.created_at } });
  } catch (error) {
    console.error('[PROFILE] Fehler beim Aktualisieren des Profils:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

authRouter.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const leaderboard = await db.any(
      `SELECT u.username, u.avatar, p.highest_wave, p.updated_at
       FROM progress p
       JOIN users u ON p.user_id = u.id
       WHERE p.highest_wave > 0
       ORDER BY p.highest_wave DESC, p.updated_at ASC
       LIMIT 100`
    );
    res.json({ leaderboard });
  } catch (error) {
    console.error('[LEADERBOARD] Fehler beim Laden:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});
