from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRAMES_DIR = ROOT / "artifacts" / "mvp_capture" / "frames"
OUTPUT_PATH = ROOT / "artifacts" / "mvp_capture" / "socialsim4_public_goods_mvp.mp4"

FPS = 30
VIDEO_SIZE = (1280, 720)
BG = "#F6F4EE"
PANEL = "#FFFDF9"
TEXT = "#2F332D"
SUBTEXT = "#667062"
ACCENT = "#6D8E69"
ACCENT_STRONG = "#5E8760"
BORDER = "#D9D2C6"
HIGHLIGHT = "#7DAA7E"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        ("C:/Windows/Fonts/msyhbd.ttc", True),
        ("C:/Windows/Fonts/msyh.ttc", False),
        ("C:/Windows/Fonts/simhei.ttf", True),
        ("C:/Windows/Fonts/simsun.ttc", False),
    ]
    for path, is_bold in candidates:
        if bold and not is_bold:
            continue
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


FONT_12 = load_font(12)
FONT_16 = load_font(16)
FONT_18 = load_font(18)
FONT_20 = load_font(20)
FONT_24 = load_font(24, bold=True)
FONT_32 = load_font(32, bold=True)
FONT_42 = load_font(42, bold=True)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ease_in_out(t: float) -> float:
    return 0.5 - math.cos(math.pi * t) / 2


def pil_to_bgr(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def fit_and_crop(image: Image.Image, size: tuple[int, int], focus_y: float = 0.5, zoom: float = 1.0) -> Image.Image:
    target_w, target_h = size
    src_w, src_h = image.size
    scale = max(target_w / src_w, target_h / src_h) * zoom
    resized_w = int(src_w * scale)
    resized_h = int(src_h * scale)
    resized = image.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    max_left = max(0, resized_w - target_w)
    max_top = max(0, resized_h - target_h)
    left = max_left // 2
    top = int(max_top * focus_y)
    top = max(0, min(top, max_top))
    return resized.crop((left, top, left + target_w, top + target_h))


def draw_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 24, fill: str = PANEL, outline: str = BORDER) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def draw_tag(draw: ImageDraw.ImageDraw, pos: tuple[int, int], text: str, fill: str = "#F0EEE7", fg: str = TEXT) -> None:
    x, y = pos
    w = int(draw.textlength(text, font=FONT_16)) + 22
    h = 34
    draw.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=fill, outline=BORDER, width=1)
    draw.text((x + 11, y + 7), text, font=FONT_16, fill=fg)


def draw_callout(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=18, outline=HIGHLIGHT, width=4)
    tag_w = int(draw.textlength(label, font=FONT_16)) + 26
    tag_h = 34
    tag_x = x1 + 14
    tag_y = max(16, y1 - 18)
    draw.rounded_rectangle((tag_x, tag_y, tag_x + tag_w, tag_y + tag_h), radius=16, fill="#F2F6EF", outline=HIGHLIGHT, width=2)
    draw.text((tag_x + 13, tag_y + 7), label, font=FONT_16, fill=ACCENT_STRONG)


def add_header(draw: ImageDraw.ImageDraw, title: str, subtitle: str) -> None:
    draw_panel(draw, (32, 24, 1248, 118), radius=26, fill="#FBFAF7")
    draw.text((56, 42), title, font=FONT_32, fill=TEXT)
    draw.text((56, 82), subtitle, font=FONT_16, fill=SUBTEXT)


def add_footer(draw: ImageDraw.ImageDraw, progress: str, note: str) -> None:
    draw_panel(draw, (32, 658, 1248, 704), radius=22, fill="#FBFAF7")
    draw.text((56, 673), progress, font=FONT_16, fill=ACCENT_STRONG)
    note_w = int(draw.textlength(note, font=FONT_16))
    draw.text((1248 - 24 - note_w, 673), note, font=FONT_16, fill=SUBTEXT)


def compose_dashboard(base_image: Image.Image, t: float) -> Image.Image:
    bg = fit_and_crop(base_image, VIDEO_SIZE, focus_y=0.08, zoom=lerp(1.0, 1.03, t))
    canvas = Image.new("RGB", VIDEO_SIZE, BG)
    canvas.paste(bg, (0, 0))
    overlay = Image.new("RGBA", VIDEO_SIZE, (255, 253, 249, 120))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    add_header(draw, "SocialSim4 MVP 录制", "首页 / 主界面静态停留 5 秒，展示当前实验桌面与继续入口")
    draw_panel(draw, (42, 144, 690, 648), radius=30, fill=(255, 253, 249))
    draw.text((76, 184), "实验桌面", font=FONT_42, fill=TEXT)
    draw.text((76, 246), "保留当前实验桌面、下一步建议与场景入口，作为 MVP 的启动画面。", font=FONT_18, fill=SUBTEXT)
    draw_tag(draw, (76, 306), "继续当前实验")
    draw_tag(draw, (222, 306), "搭建新实验")
    draw_tag(draw, (342, 306), "浏览场景")
    draw.text((76, 376), "演示节奏", font=FONT_24, fill=TEXT)
    draw.text((76, 420), "静态全局 5 秒 → 局部操作 20 秒 → 动态结果 15 秒 → 总结 5 秒", font=FONT_20, fill=SUBTEXT)
    draw.text((76, 476), "本次场景：公共品博弈", font=FONT_24, fill=ACCENT_STRONG)
    add_footer(draw, "段落 1 / 4", "研究工作台总览")
    return canvas


def compose_scene_selection(base_image: Image.Image, t: float) -> Image.Image:
    bg = fit_and_crop(base_image, VIDEO_SIZE, focus_y=0.12, zoom=lerp(1.0, 1.02, t))
    draw = ImageDraw.Draw(bg)
    add_header(draw, "选择场景：公共品博弈", "在新建实验页选择 Public Goods，保留最短可运行路径")
    draw_callout(draw, (180, 365, 710, 520), "已选择场景")
    draw_panel(draw, (760, 510, 1210, 648), radius=24, fill="#FFFDF9")
    draw.text((790, 542), "操作说明", font=FONT_24, fill=TEXT)
    draw.text((790, 586), "1. 搜索“公共品博弈”\n2. 选中场景模板\n3. 继续进入核心变量", font=FONT_18, fill=SUBTEXT, spacing=10)
    add_footer(draw, "段落 2 / 4", "局部操作：选择场景")
    return bg


def compose_workspace_intro(base_image: Image.Image, t: float) -> Image.Image:
    crop = fit_and_crop(base_image, VIDEO_SIZE, focus_y=0.02, zoom=lerp(1.0, 1.04, t))
    draw = ImageDraw.Draw(crop)
    add_header(draw, "进入实验页", "点明配置区、主画布与状态区，随后从顶部直接继续推演")
    draw_callout(draw, (688, 120, 1228, 702), "状态 / 配置区")
    draw_callout(draw, (94, 134, 1014, 480), "决策链主画布")
    draw_callout(draw, (84, 490, 1014, 706), "当前节点详情 / 结果阅读区")
    draw_tag(draw, (980, 136), "继续推演")
    add_footer(draw, "段落 2 / 4", "局部操作：指示区域并准备运行")
    return crop


def compose_dynamic_results(base_image: Image.Image, t: float) -> Image.Image:
    focus = lerp(0.05, 0.26, ease_in_out(t))
    crop = fit_and_crop(base_image, VIDEO_SIZE, focus_y=focus, zoom=1.0)
    draw = ImageDraw.Draw(crop)
    add_header(draw, "动态结果", "继续推演后，观察节点分支变化、参与者动作结果与研究日志")
    if t < 0.45:
        draw_callout(draw, (58, 124, 1000, 364), "决策链与分支")
    elif t < 0.78:
        draw_callout(draw, (58, 364, 1008, 612), "结果 / 日志")
    else:
        draw_callout(draw, (940, 420, 1236, 700), "系统指标")
    add_footer(draw, "段落 3 / 4", "动态结果：结果、指标、日志")
    return crop


def compose_summary(base_image: Image.Image, t: float) -> Image.Image:
    bg = fit_and_crop(base_image, VIDEO_SIZE, focus_y=0.08, zoom=lerp(1.01, 1.05, t))
    shade = Image.new("RGBA", VIDEO_SIZE, (246, 244, 238, 168))
    canvas = Image.alpha_composite(bg.convert("RGBA"), shade).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    draw_panel(draw, (164, 126, 1116, 586), radius=30, fill="#FFFDF9")
    draw.text((216, 178), "MVP 演示总结", font=FONT_42, fill=TEXT)
    bullets = [
        "公共品博弈场景已用最小配置成功启动",
        "实验页可以完成：配置查看、主画布观察、状态摘要、继续推演",
        "结果、指标、研究日志都已接入，可继续扩展后续录屏脚本",
    ]
    y = 266
    for bullet in bullets:
        draw.ellipse((220, y + 8, 236, y + 24), fill=ACCENT_STRONG)
        draw.text((252, y), bullet, font=FONT_20, fill=TEXT)
        y += 78
    draw_tag(draw, (216, 490), "场景：公共品博弈")
    draw_tag(draw, (410, 490), "运行：成功")
    draw_tag(draw, (536, 490), "输出：结果 / 指标 / 日志")
    add_footer(draw, "段落 4 / 4", "演示结束")
    return canvas


def add_segment(writer: cv2.VideoWriter, factory, duration_seconds: int) -> None:
    frame_count = duration_seconds * FPS
    for index in range(frame_count):
        t = 0 if frame_count == 1 else index / (frame_count - 1)
        frame = factory(t)
        writer.write(pil_to_bgr(frame))


def main() -> None:
    dashboard = Image.open(FRAMES_DIR / "dashboard_overview.png").convert("RGB")
    scene = Image.open(FRAMES_DIR / "wizard_scene_selected.png").convert("RGB")
    workspace = Image.open(FRAMES_DIR / "workspace_dynamic_metrics_logs.png").convert("RGB")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(OUTPUT_PATH),
        cv2.VideoWriter_fourcc(*"mp4v"),
        FPS,
        VIDEO_SIZE,
    )

    add_segment(writer, lambda t: compose_dashboard(dashboard, t), 5)
    add_segment(writer, lambda t: compose_scene_selection(scene, t), 6)
    add_segment(writer, lambda t: compose_workspace_intro(workspace, t), 14)
    add_segment(writer, lambda t: compose_dynamic_results(workspace, t), 15)
    add_segment(writer, lambda t: compose_summary(dashboard, t), 5)

    writer.release()
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
