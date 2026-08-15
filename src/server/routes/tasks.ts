import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { dbRepository } from '../db/supabaseClient.js';

export const tasksRouter = Router();

// Apply auth middleware to all tasks routes
tasksRouter.use(authMiddleware);

// GET /api/tasks - List tasks for authenticated user
tasksRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const status = (req.query.status as string) || 'pending';

    const tasks = await dbRepository.listTasks(userId, status);
    res.json(tasks);
  } catch (error: any) {
    console.error('GET /api/tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks', details: error.message });
  }
});

// POST /api/tasks - Create a new task
tasksRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { title, dueDate, priority, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const newTask = await dbRepository.createTask(userId, {
      title,
      dueDate,
      priority,
      category
    });

    res.status(201).json(newTask);
  } catch (error: any) {
    console.error('POST /api/tasks error:', error);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// PUT /api/tasks/:id/complete - Mark task as completed
tasksRouter.put('/:id/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const taskId = req.params.id;

    const updated = await dbRepository.updateTask(userId, taskId, { status: 'completed' });
    res.json(updated);
  } catch (error: any) {
    console.error('PUT /api/tasks/:id/complete error:', error);
    res.status(500).json({ error: 'Failed to complete task', details: error.message });
  }
});

// PUT /api/tasks/:id - Update task details
tasksRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const taskId = req.params.id;

    const updated = await dbRepository.updateTask(userId, taskId, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error('PUT /api/tasks/:id error:', error);
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
});

// DELETE /api/tasks/:id - Delete task
tasksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const taskId = req.params.id;

    const result = await dbRepository.deleteTask(userId, taskId);
    res.json(result);
  } catch (error: any) {
    console.error('DELETE /api/tasks/:id error:', error);
    res.status(500).json({ error: 'Failed to delete task', details: error.message });
  }
});
