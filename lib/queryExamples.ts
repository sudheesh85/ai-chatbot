import { QueryExample } from '@/types';

export const queryExamples: QueryExample[] = [
  {
    id: '1',
    text: 'How many records are in the database?',
    category: 'General',
  },
  {
    id: '2',
    text: 'Show me the top 10 items by sales',
    category: 'Sales',
  },
  {
    id: '3',
    text: 'What is the total revenue this month?',
    category: 'Finance',
  },
  {
    id: '4',
    text: 'List all students in grade 5',
    category: 'Education',
  },
  {
    id: '5',
    text: 'Show me the average temperature for each month',
    category: 'Agriculture',
  },
  {
    id: '6',
    text: 'How many products were sold last week?',
    category: 'Sales',
  },
  {
    id: '7',
    text: 'What are the most common crops grown?',
    category: 'Agriculture',
  },
  {
    id: '8',
    text: 'Show me all classes with more than 30 students',
    category: 'Education',
  },
];

export const getExamplesByCategory = (category?: string): QueryExample[] => {
  if (!category) return queryExamples;
  return queryExamples.filter(ex => ex.category === category);
};

