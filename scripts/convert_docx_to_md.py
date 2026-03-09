"""
Convert .docx tutorial to markdown format.

Extracts content and images from the tutorial document,
generating properly formatted markdown with image references.
"""

from docx import Document
from pathlib import Path
import re

doc_path = r'C:\Users\justi\Documents\ZJU_Work\社会仿真平台操作教程（Tutorial Doc） (1).docx'
doc = Document(doc_path)

# Track image index
image_index = 0

# Build markdown content
markdown_lines = []

for i, para in enumerate(doc.paragraphs):
    text = para.text.strip()

    # Check for images in this paragraph
    has_image = any('graphic' in run._element.xml for run in para.runs)

    # Detect headings based on style
    style = para.style.name if para.style else 'Normal'

    # Skip empty paragraphs without images
    if not text and not has_image:
        continue

    if has_image:
        image_index += 1
        markdown_lines.append('')
        markdown_lines.append(f'![Tutorial Screenshot](/uploads/extracted-doc-images/tutorial-img-{image_index}.png)')
        markdown_lines.append('')
        continue

    if text:
        # Main title
        if text == '社会仿真平台操作教程（Tutorial Doc）':
            markdown_lines.append(f'# {text}')

        # Level 1 headings (X. Title)
        elif re.match(r'^\d+\.\s+\S', text) and not re.match(r'^\d+\.\s+\d+\.', text):
            markdown_lines.append(f'## {text}')

        # Level 2 headings (X.Y Title)
        elif re.match(r'^\d+\.\d+\s+\S', text):
            markdown_lines.append(f'### {text}')

        # Level 3 headings (X.Y.Z Title)
        elif re.match(r'^\d+\.\d+\.\d+\s+\S', text):
            markdown_lines.append(f'#### {text}')

        # Subsection with colon
        elif text.endswith('：') or text.endswith(':'):
            markdown_lines.append(f'#### {text}')

        # Bold options and keywords
        elif text.startswith('选项一：') or text.startswith('选项二：') or text.startswith('方式') or text.startswith('问题'):
            markdown_lines.append(f'**{text}**')

        # Regular paragraph - check if it's a numbered list item
        elif re.match(r'^##?\s+\d+\.\s+', text):
            # Remove the ## prefix if present (formatting artifact from doc)
            text = re.sub(r'^##?\s+', '', text)
            markdown_lines.append(text)
        elif text.startswith('##'):
            # Artifact - convert to proper markdown list
            text = text.replace('##', '').strip()
            if re.match(r'^\d+\.\s+', text):
                markdown_lines.append(text)
            else:
                markdown_lines.append(f'{text}')
        else:
            markdown_lines.append(f'{text}')

markdown_content = '\n'.join(markdown_lines)

# Write to file
output_dir = Path('frontend/docs')
output_dir.mkdir(parents=True, exist_ok=True)

with open(output_dir / 'tutorial-zh.md', 'w', encoding='utf-8') as f:
    f.write(markdown_content)

print(f'Generated {output_dir / "tutorial-zh.md"}')
print(f'Total images: {image_index}')
