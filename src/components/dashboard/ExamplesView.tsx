import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lightbulb, Copy, Check, Globe, Code2, Wrench, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Example {
  title: string;
  description: string;
  content: string;
  language?: string;
}

interface ExampleCategory {
  realWorld: Example[];
  implementation: Example[];
  codingSamples: Example[];
}

const examplesDatabase: Record<string, ExampleCategory> = {
  javascript: {
    realWorld: [
      { 
        title: 'E-commerce Shopping Cart', 
        description: 'A real-world shopping cart that tracks items, quantities, and calculates totals.',
        content: `// Shopping cart for an online store
const cart = {
  items: [],
  addItem(product, quantity = 1) {
    const existing = this.items.find(i => i.id === product.id);
    if (existing) existing.quantity += quantity;
    else this.items.push({ ...product, quantity });
  },
  getTotal() {
    return this.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );
  }
};`
      },
      { 
        title: 'Weather Dashboard', 
        description: 'Fetching and displaying weather data from an API.',
        content: `// Fetch weather data for a city
async function getWeather(city) {
  const response = await fetch(
    \`https://api.weather.com/data?city=\${city}\`
  );
  const data = await response.json();
  
  return {
    temperature: data.temp,
    condition: data.weather,
    humidity: data.humidity
  };
}`
      },
    ],
    implementation: [
      { 
        title: 'Debounce Function', 
        description: 'Limit how often a function can be called.',
        content: `function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// Usage: Search input that waits for user to stop typing
const debouncedSearch = debounce(searchAPI, 300);`
      },
      { 
        title: 'Local Storage Wrapper', 
        description: 'Type-safe local storage with JSON parsing.',
        content: `const storage = {
  get(key, defaultValue = null) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};`
      },
    ],
    codingSamples: [
      { 
        title: 'Array Methods', 
        description: 'Common array operations in JavaScript.',
        content: `const numbers = [1, 2, 3, 4, 5];

// Map - transform each element
const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

// Filter - keep elements that pass test
const evens = numbers.filter(n => n % 2 === 0);
// [2, 4]

// Reduce - combine into single value
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15`,
        language: 'javascript'
      },
      { 
        title: 'Async/Await Pattern', 
        description: 'Modern asynchronous JavaScript.',
        content: `async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    
    if (!response.ok) {
      throw new Error('User not found');
    }
    
    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}`,
        language: 'javascript'
      },
    ]
  },
  python: {
    realWorld: [
      { 
        title: 'Data Analysis Pipeline', 
        description: 'Processing CSV data for analysis.',
        content: `import pandas as pd

def analyze_sales(file_path):
    # Load and clean data
    df = pd.read_csv(file_path)
    df['date'] = pd.to_datetime(df['date'])
    
    # Calculate metrics
    monthly_sales = df.groupby(
        df['date'].dt.month
    )['amount'].sum()
    
    return {
        'total': df['amount'].sum(),
        'average': df['amount'].mean(),
        'monthly': monthly_sales.to_dict()
    }`,
        language: 'python'
      },
    ],
    implementation: [
      { 
        title: 'Decorator Pattern', 
        description: 'Add functionality to functions.',
        content: `def timer(func):
    import time
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end-start:.2f}s")
        return result
    return wrapper

@timer
def slow_function():
    time.sleep(1)
    return "Done"`,
        language: 'python'
      },
    ],
    codingSamples: [
      { 
        title: 'List Comprehension', 
        description: 'Pythonic way to create lists.',
        content: `# Basic list comprehension
squares = [x**2 for x in range(10)]

# With condition
evens = [x for x in range(20) if x % 2 == 0]

# Nested comprehension
matrix = [[i*j for j in range(3)] for i in range(3)]

# Dictionary comprehension
word_lengths = {word: len(word) for word in ['hello', 'world']}`,
        language: 'python'
      },
    ]
  },
};

const categories = [
  { id: 'realWorld', label: 'Real-World Scenarios', icon: Globe },
  { id: 'implementation', label: 'Implementation', icon: Wrench },
  { id: 'codingSamples', label: 'Coding Samples', icon: Code2 },
];

export default function ExamplesView() {
  const [topic, setTopic] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSearch = () => {
    if (!topic.trim()) return;
    // Map common searches to available topics
    const searchTerm = topic.toLowerCase();
    if (searchTerm.includes('javascript') || searchTerm.includes('js') || searchTerm.includes('react')) {
      setSelectedTopic('javascript');
    } else if (searchTerm.includes('python') || searchTerm.includes('data')) {
      setSelectedTopic('python');
    } else {
      setSelectedTopic('javascript'); // Default
    }
  };

  const handleCopy = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentExamples = selectedTopic && selectedCategory
    ? examplesDatabase[selectedTopic][selectedCategory as keyof ExampleCategory]
    : [];

  // Topic selection
  if (!selectedTopic) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Lightbulb className="h-7 w-7 text-primary" />
          Examples
        </h2>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8"
        >
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-muted-foreground">
              Enter a topic to find examples
            </label>
            <div className="flex gap-2">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., JavaScript, Python, React..."
                className="bg-muted/30 border-border/50 h-12"
              />
              <Button onClick={handleSearch} disabled={!topic.trim()} className="px-6">
                Search
              </Button>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-6">
            <label className="block text-sm font-medium mb-4 text-muted-foreground">
              Quick select
            </label>
            <div className="flex gap-3">
              {Object.keys(examplesDatabase).map(key => (
                <Button
                  key={key}
                  variant="outline"
                  onClick={() => setSelectedTopic(key)}
                  className="capitalize"
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Category selection
  if (!selectedCategory) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lightbulb className="h-7 w-7 text-primary" />
            {selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)} Examples
          </h2>
          <Button variant="outline" size="sm" onClick={() => setSelectedTopic(null)}>
            Change Topic
          </Button>
        </div>
        
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedCategory(cat.id)}
              className="w-full glass rounded-xl p-5 flex items-center justify-between hover:bg-muted/20 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <cat.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-lg">{cat.label}</span>
                  <p className="text-sm text-muted-foreground">
                    {examplesDatabase[selectedTopic][cat.id as keyof ExampleCategory].length} examples
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // Examples list
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Lightbulb className="h-7 w-7 text-primary" />
          {categories.find(c => c.id === selectedCategory)?.label}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setSelectedCategory(null)}>
          Back to Categories
        </Button>
      </div>
      
      <div className="space-y-4">
        {currentExamples.map((example, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-xl overflow-hidden"
          >
            <div className="p-5 border-b border-border/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-lg">{example.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{example.description}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleCopy(example.content, i)}
                  className="flex-shrink-0"
                >
                  {copiedIndex === i ? (
                    <Check className="h-4 w-4 text-notez-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="bg-background/50 p-4">
              <pre className="text-sm overflow-x-auto">
                <code className="text-muted-foreground">{example.content}</code>
              </pre>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
