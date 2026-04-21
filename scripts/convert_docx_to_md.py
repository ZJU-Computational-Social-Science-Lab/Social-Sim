"""
Convert .docx tutorial to markdown format.

Extracts content and images from the tutorial document,
generating properly formatted markdown with image references.
"""

import argparse
from pathlib import Path
import re

from docx import Document


def build_markdown(doc_path: Path, output_path: Path) -> int:
    doc = Document(str(doc_path))

    image_index = 0
    markdown_lines = []

    for para in doc.paragraphs:
        text = para.text.strip()

        # Check for images in this paragraph
        has_image = any('graphic' in run._element.xml for run in para.runs)

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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown_content, encoding='utf-8')
    return image_index


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a tutorial .docx file to markdown.")
    parser.add_argument("docx_path", type=Path, help="Path to the input .docx file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/docs/tutorial-zh.md"),
        help="Path to the output markdown file",
    )
    args = parser.parse_args()

    image_count = build_markdown(args.docx_path, args.output)
    print(f"Generated {args.output}")
    print(f"Total images: {image_count}")


if __name__ == "__main__":
    main()
