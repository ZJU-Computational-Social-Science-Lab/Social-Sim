from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_AUTO_SIZE
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "presentation_assets"
OUT_PATH = OUT_DIR / "FOS_platform_presentation.pptx"
TUTORIAL_DIR = ROOT / "frontend" / "public" / "tutorial"


PALETTE = {
    "bg": RGBColor(0xFF, 0xFE, 0xF9),
    "bg_soft": RGBColor(0xF8, 0xF4, 0xEC),
    "surface": RGBColor(0xFF, 0xFD, 0xF8),
    "surface_alt": RGBColor(0xFB, 0xF8, 0xF2),
    "primary": RGBColor(0xD4, 0xA3, 0x73),
    "primary_dark": RGBColor(0xB9, 0x88, 0x59),
    "text": RGBColor(0x3C, 0x32, 0x28),
    "muted": RGBColor(0x8B, 0x73, 0x55),
    "border": RGBColor(0xE5, 0xDF, 0xD5),
    "success": RGBColor(0x9D, 0xB8, 0xAB),
    "accent": RGBColor(0xD9, 0xC7, 0xAD),
    "white": RGBColor(0xFF, 0xFF, 0xFF),
}


def set_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_round_rect(slide, left, top, width, height, fill, line=None, radius=True):
    shape_type = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line or fill
    shape.line.width = Pt(1)
    return shape


def add_textbox(slide, left, top, width, height, text, font_size=20, bold=False,
                color=None, font_name="PingFang SC", align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    p = frame.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.name = font_name
    run.font.color.rgb = color or PALETTE["text"]
    return box


def add_bullets(slide, left, top, width, height, bullets, font_size=20,
                color=None, bullet_color=None, level0_gap=10):
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    frame.clear()
    for idx, bullet in enumerate(bullets):
        p = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        p.text = bullet
        p.level = 0
        p.font.size = Pt(font_size)
        p.font.name = "PingFang SC"
        p.font.color.rgb = color or PALETTE["text"]
        p.line_spacing = 1.2
        p.space_after = Pt(level0_gap)
        if bullet_color:
            p.bullet.color.rgb = bullet_color
    return box


def add_tag(slide, left, top, text, fill=None, line=None, text_color=None, width=None):
    width = width or Inches(max(1.0, 0.18 * len(text) + 0.5))
    shape = add_round_rect(slide, left, top, width, Inches(0.38), fill or PALETTE["surface"], line or PALETTE["border"])
    tf = shape.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = text
    run.font.name = "PingFang SC"
    run.font.size = Pt(10.5)
    run.font.bold = True
    run.font.color.rgb = text_color or PALETTE["primary_dark"]
    return shape


def add_title_block(slide, section, title, subtitle=None):
    add_textbox(slide, Inches(0.65), Inches(0.42), Inches(1.8), Inches(0.28), section,
                font_size=11, bold=True, color=PALETTE["primary"])
    add_textbox(slide, Inches(0.65), Inches(0.7), Inches(6.2), Inches(0.55), title,
                font_size=26, bold=True, color=PALETTE["text"])
    if subtitle:
        add_textbox(slide, Inches(0.65), Inches(1.2), Inches(6.6), Inches(0.55), subtitle,
                    font_size=12, color=PALETTE["muted"])


def add_picture_frame(slide, image_path, left, top, width, height, title=None):
    add_round_rect(slide, left, top, width, height, PALETTE["surface"], PALETTE["border"])
    slide.shapes.add_picture(str(image_path), left + Inches(0.05), top + Inches(0.05), width - Inches(0.1), height - Inches(0.1))
    if title:
        add_tag(slide, left + Inches(0.12), top + Inches(0.08), title,
                fill=PALETTE["bg_soft"], line=PALETTE["border"], text_color=PALETTE["primary_dark"])


def add_stat_card(slide, left, top, width, height, title, value, subtitle):
    card = add_round_rect(slide, left, top, width, height, PALETTE["surface"], PALETTE["border"])
    card.shadow.inherit = False
    add_textbox(slide, left + Inches(0.18), top + Inches(0.18), width - Inches(0.35), Inches(0.25), title,
                font_size=11, bold=True, color=PALETTE["muted"])
    add_textbox(slide, left + Inches(0.18), top + Inches(0.42), width - Inches(0.35), Inches(0.45), value,
                font_size=24, bold=True, color=PALETTE["primary_dark"])
    add_textbox(slide, left + Inches(0.18), top + Inches(0.86), width - Inches(0.35), Inches(0.4), subtitle,
                font_size=10.5, color=PALETTE["muted"])


def add_flow_chip(slide, left, top, text, active=False):
    fill = PALETTE["primary"] if active else PALETTE["surface"]
    line = PALETTE["primary"] if active else PALETTE["border"]
    text_color = PALETTE["white"] if active else PALETTE["text"]
    return add_tag(slide, left, top, text, fill=fill, line=line, text_color=text_color, width=Inches(1.45))


def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    img_overview = TUTORIAL_DIR / "01-overview.png"
    img_dashboard = TUTORIAL_DIR / "02-dashboard.png"
    img_new = TUTORIAL_DIR / "03-new-simulation.png"
    img_agents = TUTORIAL_DIR / "04-agent-generation.png"
    img_workspace = TUTORIAL_DIR / "05-simulation-view.png"
    img_host = TUTORIAL_DIR / "06-host-panel.png"
    img_design = TUTORIAL_DIR / "07-experiment-design.png"
    img_analytics = TUTORIAL_DIR / "08-analytics.png"
    img_network = TUTORIAL_DIR / "09-network-topology.png"
    img_export = TUTORIAL_DIR / "10-export-reports.png"

    # Slide 1
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_round_rect(slide, Inches(0.35), Inches(0.3), Inches(12.6), Inches(6.9), PALETTE["surface"], PALETTE["border"])
    add_textbox(slide, Inches(0.75), Inches(0.7), Inches(0.9), Inches(0.3), "FOS", font_size=16, bold=True, color=PALETTE["primary"])
    add_textbox(slide, Inches(0.75), Inches(1.05), Inches(5.6), Inches(1.0), "Future of Society\n社会仿真平台", font_size=28, bold=True, color=PALETTE["text"])
    add_textbox(
        slide,
        Inches(0.78), Inches(2.15), Inches(5.4), Inches(1.2),
        "一个基于大语言模型的多智能体社会仿真系统\n支持分支、干预、对比、日志观察与总结分析",
        font_size=16, color=PALETTE["muted"]
    )
    add_tag(slide, Inches(0.8), Inches(3.45), "研究型平台", fill=PALETTE["bg_soft"], line=PALETTE["border"])
    add_tag(slide, Inches(2.05), Inches(3.45), "实验树", fill=PALETTE["bg_soft"], line=PALETTE["border"])
    add_tag(slide, Inches(3.0), Inches(3.45), "因果干预", fill=PALETTE["bg_soft"], line=PALETTE["border"])
    add_tag(slide, Inches(4.2), Inches(3.45), "结果分析", fill=PALETTE["bg_soft"], line=PALETTE["border"])
    add_picture_frame(slide, img_overview, Inches(6.55), Inches(0.75), Inches(5.95), Inches(2.55), title="平台首页")
    add_picture_frame(slide, img_workspace, Inches(6.55), Inches(3.55), Inches(5.95), Inches(2.95), title="仿真工作台")
    add_textbox(slide, Inches(0.78), Inches(5.85), Inches(5.2), Inches(0.5), "汇报结构：平台介绍 / 使用流程 / 核心功能 / 简单案例 / 复杂案例", font_size=12, color=PALETTE["muted"])

    # Slide 2
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "PART 1", "平台整体介绍", "它不是一个‘让智能体聊天’的演示器，而是一个在线社会实验工作台。")
    add_bullets(slide, Inches(0.8), Inches(1.55), Inches(6.0), Inches(4.7), [
        "面向研究问题：合作、冲突、传播、规范、政策执行、组织层级等。",
        "核心对象不是单个回答，而是多角色、多规则、多信息源持续作用后的社会过程。",
        "用户既可以创建实验，也可以在运行中做分支、干预、对比和总结。",
        "平台同时保留结构化实验设计与开放式社会互动两种能力。",
    ], font_size=19, color=PALETTE["text"])
    add_stat_card(slide, Inches(7.35), Inches(1.6), Inches(2.2), Inches(1.55), "定位", "研究型", "强调可控、可观察、可比较")
    add_stat_card(slide, Inches(9.7), Inches(1.6), Inches(2.2), Inches(1.55), "核心机制", "实验树", "支持平行条件与历史分支")
    add_stat_card(slide, Inches(7.35), Inches(3.45), Inches(2.2), Inches(1.55), "运行方式", "推进节点", "推进的是社会过程而不是页面")
    add_stat_card(slide, Inches(9.7), Inches(3.45), Inches(2.2), Inches(1.55), "输出", "日志 + 报告", "保留全流程证据与总结")
    add_picture_frame(slide, img_dashboard, Inches(7.2), Inches(5.25), Inches(4.8), Inches(1.5), title="研究桌面")

    # Slide 3
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "WHY", "为什么要做这样一个平台？", "因为很多现实问题都不是单一主体瞬时决策的结果，而是群体互动的累积结果。")
    problems = [
        ("政策传播", "为什么政策在传播中会逐渐走样？"),
        ("合作形成", "为什么合作在某些条件下会建立，在另一些条件下会崩溃？"),
        ("信息扩散", "为什么信息会在某种网络里快速传播，在另一种结构里被扭曲或阻断？"),
        ("因果验证", "仅看最终结果很难解释过程，仅靠直觉也很难验证因果关系。"),
    ]
    left = Inches(0.8)
    top = Inches(1.65)
    for idx, (title, body) in enumerate(problems):
        row = idx // 2
        col = idx % 2
        x = left + col * Inches(3.2)
        y = top + row * Inches(2.0)
        add_round_rect(slide, x, y, Inches(2.85), Inches(1.55), PALETTE["surface"], PALETTE["border"])
        add_textbox(slide, x + Inches(0.18), y + Inches(0.18), Inches(2.3), Inches(0.3), title, font_size=16, bold=True, color=PALETTE["primary_dark"])
        add_textbox(slide, x + Inches(0.18), y + Inches(0.55), Inches(2.45), Inches(0.68), body, font_size=12, color=PALETTE["muted"])
    add_picture_frame(slide, img_network, Inches(7.35), Inches(1.55), Inches(5.0), Inches(4.7), title="网络结构与扩散")
    add_textbox(slide, Inches(7.45), Inches(6.45), Inches(4.8), Inches(0.35), "同样的角色设定，在不同拓扑、规则与干预条件下，会导向不同结果。", font_size=11.5, color=PALETTE["muted"])

    # Slide 4
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "ARCHITECTURE", "FOS 的系统结构", "从网页控制台到后端仿真引擎，再到场景、角色与分析能力，形成完整闭环。")
    blocks = [
        ("前端工作界面", "注册登录、参数配置、运行控制、日志查看、结果分析"),
        ("后端仿真引擎", "规则执行、顺序调度、事件记录、状态更新、实验树管理"),
        ("场景模板系统", "博弈论、社会学、讨论类等预设场景与参数"),
        ("智能体系统", "模板角色、AI 批量生成、导入角色数据"),
        ("实验树", "从同一历史节点出发进行分支、对比与回溯"),
        ("分析与导出", "AI 报告、日志摘要、模板保存与结果导出"),
    ]
    for idx, (title, body) in enumerate(blocks):
        x = Inches(0.75 + (idx % 3) * 4.15)
        y = Inches(1.55 + (idx // 3) * 2.35)
        add_round_rect(slide, x, y, Inches(3.65), Inches(1.75), PALETTE["surface"], PALETTE["border"])
        add_textbox(slide, x + Inches(0.18), y + Inches(0.18), Inches(3.2), Inches(0.28), title, font_size=15, bold=True, color=PALETTE["text"])
        add_textbox(slide, x + Inches(0.18), y + Inches(0.55), Inches(3.1), Inches(0.8), body, font_size=11.5, color=PALETTE["muted"])
    add_textbox(slide, Inches(0.82), Inches(6.45), Inches(10.7), Inches(0.3), "理解方式：用户操作的是实验控制台，真正推进社会过程的是后端仿真引擎。", font_size=11.5, color=PALETTE["primary_dark"])

    # Slide 5
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "FEATURES", "这套装置最鲜明的五个特点", None)
    features = [
        ("可控", "用户不是旁观者，而是实验设计者。"),
        ("可观察", "关键行为、动作、事件和变化会被持续记录。"),
        ("可比较", "可以从同一状态制造多个平行条件进行对照。"),
        ("可扩展", "支持知识注入、网络拓扑、环境事件等复杂机制。"),
        ("面向真实问题", "服务于合作、传播、规范、政策执行等研究。"),
    ]
    for idx, (title, body) in enumerate(features):
        y = Inches(1.45 + idx * 1.07)
        add_round_rect(slide, Inches(0.9), y, Inches(11.5), Inches(0.82), PALETTE["surface"], PALETTE["border"])
        add_tag(slide, Inches(1.12), y + Inches(0.18), f"0{idx + 1}", fill=PALETTE["primary"], line=PALETTE["primary"], text_color=PALETTE["white"], width=Inches(0.52))
        add_textbox(slide, Inches(1.78), y + Inches(0.12), Inches(1.4), Inches(0.3), title, font_size=16, bold=True, color=PALETTE["primary_dark"])
        add_textbox(slide, Inches(3.0), y + Inches(0.12), Inches(8.7), Inches(0.36), body, font_size=12.2, color=PALETTE["muted"])

    # Slide 6
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "REFERENCE", "FOS 与“斯坦福小镇 / Generative Agents”有什么关系？", "共同点是都在模拟社会过程，不同点是 FOS 更强调实验性、可控性和可分析性。")
    add_round_rect(slide, Inches(0.9), Inches(1.65), Inches(4.9), Inches(3.8), PALETTE["surface"], PALETTE["border"])
    add_textbox(slide, Inches(1.2), Inches(1.95), Inches(3.8), Inches(0.4), "Generative Agents / Stanford Town", font_size=18, bold=True, color=PALETTE["text"])
    add_bullets(slide, Inches(1.2), Inches(2.45), Inches(4.0), Inches(2.3), [
        "强调开放式日常生活模拟与群体涌现。",
        "通过记忆、计划与反思机制让角色更像“持续生活”。",
        "更偏向展示复杂社会互动本身的生成效果。",
    ], font_size=13, color=PALETTE["muted"])
    add_round_rect(slide, Inches(7.5), Inches(1.65), Inches(4.9), Inches(3.8), PALETTE["surface"], PALETTE["border"])
    add_textbox(slide, Inches(7.8), Inches(1.95), Inches(3.8), Inches(0.4), "FOS", font_size=18, bold=True, color=PALETTE["text"])
    add_bullets(slide, Inches(7.8), Inches(2.45), Inches(4.0), Inches(2.3), [
        "强调实验设计、条件控制、分支对比与因果分析。",
        "支持用户在运行中插入干预，并保留不同路径结果。",
        "更偏向研究型平台，而不是仅展示社会涌现。",
    ], font_size=13, color=PALETTE["muted"])
    arrow = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(5.95), Inches(3.45), Inches(7.15), Inches(3.45))
    arrow.line.color.rgb = PALETTE["primary"]
    arrow.line.width = Pt(2.5)
    add_round_rect(slide, Inches(5.4), Inches(3.05), Inches(1.6), Inches(0.75), PALETTE["bg_soft"], PALETTE["border"])
    add_textbox(slide, Inches(5.5), Inches(3.2), Inches(1.4), Inches(0.24), "从演示型涌现 → 研究型实验", font_size=10.5, bold=True, color=PALETTE["primary_dark"], align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(1.0), Inches(6.0), Inches(11.2), Inches(0.45), "这一页不嵌外部网络图片，避免版权风险；重点放在对平台定位差异的解释。", font_size=10.5, color=PALETTE["muted"])

    # Slide 7
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "PART 2", "新用户如何从零开始跑起一个实验？", "从注册、模型配置、新建模拟，到进入工作台推进节点，整个路径可以拆成六步。")
    steps = ["注册登录", "配置 LLM", "创建模拟", "配置角色与网络", "推进节点", "观察 / 保存 / 分析"]
    start = Inches(0.9)
    for idx, step in enumerate(steps):
        x = start + idx * Inches(1.95)
        add_flow_chip(slide, x, Inches(2.2), f"{idx + 1}. {step}", active=idx == 0)
        if idx < len(steps) - 1:
            connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x + Inches(1.45), Inches(2.39), x + Inches(1.85), Inches(2.39))
            connector.line.color.rgb = PALETTE["accent"]
            connector.line.width = Pt(2)
    add_picture_frame(slide, img_new, Inches(1.1), Inches(3.2), Inches(5.1), Inches(2.8), title="创建向导")
    add_bullets(slide, Inches(6.7), Inches(3.25), Inches(5.2), Inches(2.5), [
        "先完成模型配置，再开始创建模拟。",
        "建议首次使用时优先选择预设场景，而不是从零定义机制。",
        "创建完成后进入工作台，通过“推进节点”让社会过程继续演化。",
        "日志、分支和分析报告共同构成实验证据链。",
    ], font_size=16, color=PALETTE["text"])

    # Slide 8
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 1-2", "第一步注册登录，第二步先配置模型", "对新用户来说，最重要的不是立刻新建模拟，而是先让底层模型能力配置稳定。")
    add_round_rect(slide, Inches(0.9), Inches(1.65), Inches(5.2), Inches(4.8), PALETTE["surface"], PALETTE["border"])
    add_textbox(slide, Inches(1.2), Inches(1.95), Inches(4.4), Inches(0.4), "操作顺序", font_size=18, bold=True, color=PALETTE["primary_dark"])
    add_bullets(slide, Inches(1.2), Inches(2.4), Inches(4.45), Inches(3.3), [
        "注册账号并登录平台。",
        "进入设置页面，新增 LLM 提供商。",
        "填写名称、类型、模型名称、Base URL / API Key。",
        "保存并测试连接，通过后再开始创建实验。",
        "如需要外部检索能力，再额外配置搜索提供商。",
    ], font_size=16, color=PALETTE["text"])
    add_picture_frame(slide, img_dashboard, Inches(6.55), Inches(1.6), Inches(5.5), Inches(4.95), title="登录后的主界面")

    # Slide 9
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 3", "第三步：选择场景并创建模拟", "预设场景已经整理好了规则、动作空间和基础逻辑，第一次使用建议从这里入手。")
    add_bullets(slide, Inches(0.85), Inches(1.6), Inches(5.5), Inches(3.6), [
        "博弈论类：如囚徒困境、鹿猎博弈等经典模型。",
        "社会学类：如政策意义侵蚀、回音室、社会规范扰动、资源稀缺。",
        "讨论类：适合自由交流与非严格结构化实验。",
        "预设通常包括背景说明、参与角色、动作、参数与初始环境。",
    ], font_size=16, color=PALETTE["text"])
    add_round_rect(slide, Inches(0.9), Inches(5.45), Inches(5.3), Inches(0.8), PALETTE["bg_soft"], PALETTE["border"])
    add_textbox(slide, Inches(1.1), Inches(5.67), Inches(4.8), Inches(0.25), "理解方式：你面对的不是一张空白纸，而是一个已经搭好的实验框架。", font_size=11.5, color=PALETTE["primary_dark"])
    add_picture_frame(slide, img_new, Inches(6.6), Inches(1.45), Inches(5.3), Inches(4.95), title="新建实验向导")

    # Slide 10
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 3", "智能体配置：三种进入方式", "平台支持手动创建、AI 批量生成和导入角色三种路径。")
    cards = [
        ("手动输入模板角色", "自己填写名字、身份、简介、描述与属性。"),
        ("AI 批量生成", "根据人数、角色分布、属性分布快速生成差异化角色。"),
        ("导入智能体", "将已有角色表或结构化数据快速带入平台。"),
    ]
    for idx, (title, body) in enumerate(cards):
        x = Inches(0.9 + idx * 3.2)
        add_round_rect(slide, x, Inches(1.75), Inches(2.85), Inches(1.55), PALETTE["surface"], PALETTE["border"])
        add_textbox(slide, x + Inches(0.18), Inches(1.95), Inches(2.45), Inches(0.35), title, font_size=15, bold=True, color=PALETTE["text"])
        add_textbox(slide, x + Inches(0.18), Inches(2.35), Inches(2.45), Inches(0.55), body, font_size=11.5, color=PALETTE["muted"])
    add_picture_frame(slide, img_agents, Inches(0.95), Inches(3.7), Inches(6.0), Inches(2.8), title="AI 批量生成角色")
    add_bullets(slide, Inches(7.45), Inches(3.85), Inches(4.6), Inches(2.4), [
        "可设置总人数、群体比例、合作倾向、认知水平、传播意愿、风险偏好等变量。",
        "生成后还能预览和微调，避免角色重复或设定失真。",
        "建议在确认创建前检查人数、角色类型和属性是否合理。",
    ], font_size=15, color=PALETTE["text"])

    # Slide 11
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 3", "拓扑网络：不是简单连线，而是在定义互动路径", "同一组智能体在不同网络结构下，可能会产生完全不同的传播与决策结果。")
    add_picture_frame(slide, img_network, Inches(0.85), Inches(1.5), Inches(6.15), Inches(5.2), title="关系网络编辑")
    add_bullets(slide, Inches(7.35), Inches(1.65), Inches(4.7), Inches(4.6), [
        "平台支持环形、星型、小世界等常见网络结构，也可以手动编辑。",
        "网络位置会影响角色的影响力、接触范围和信息流速。",
        "信息在中心化网络中往往扩散更快，在分散网络中更局部。",
        "所以这里不是配角步骤，而是在定义整个社会系统的互动路径。",
    ], font_size=16, color=PALETTE["text"])

    # Slide 12
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 4", "进入仿真工作台：左树、中区、右侧信息流", "工作台把分支结构、当前节点、日志与角色状态整合到同一个观察界面。")
    add_picture_frame(slide, img_workspace, Inches(0.75), Inches(1.45), Inches(7.4), Inches(5.55), title="仿真工作台")
    add_bullets(slide, Inches(8.45), Inches(1.6), Inches(4.2), Inches(4.8), [
        "左侧：实验树或节点区域，显示当前模拟结构。",
        "中间：当前场景主舞台，包括节点信息、推进按钮、对比入口。",
        "右侧：日志、对话、状态与记忆信息，方便观察运行过程。",
        "顶部：推进节点、创建分支、导出、分析报告、知识库、网络拓扑等入口。",
    ], font_size=15.2, color=PALETTE["text"])

    # Slide 13
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 4", "最关键的操作：推进节点", "推进节点不是刷新页面，而是在推进一个社会过程。")
    add_round_rect(slide, Inches(0.85), Inches(1.55), Inches(5.6), Inches(4.9), PALETTE["surface"], PALETTE["border"])
    add_bullets(slide, Inches(1.1), Inches(1.9), Inches(4.95), Inches(3.7), [
        "点击后，平台会在当前节点基础上继续运行一段仿真。",
        "智能体会依据自己的设定和场景规则采取行动。",
        "可能出现的动作包括：合作、背叛、传播、解释、服从、阻断、发言、汇报等。",
        "系统会把这些动作转成日志与状态变化，供用户回看。",
        "所以每推进一次，本质上都是在让这个小型社会继续往前走。",
    ], font_size=15, color=PALETTE["text"])
    add_picture_frame(slide, img_host, Inches(6.8), Inches(1.55), Inches(5.4), Inches(2.25), title="宿主控制与事件")
    add_picture_frame(slide, img_design, Inches(6.8), Inches(4.05), Inches(5.4), Inches(2.25), title="对照设计与干预")

    # Slide 14
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "STEP 5-6", "观察日志、进行干预、保存并继续扩展", "真正的分析不只看最终结论，更要看过程证据、关键转折点和不同分支的差异。")
    add_bullets(slide, Inches(0.9), Inches(1.55), Inches(5.5), Inches(4.8), [
        "日志会告诉你：谁先行动、说了什么、其他角色如何回应、环境是否变化。",
        "可以筛选系统日志、环境日志、智能体行为日志、宿主干预日志等。",
        "实验跑起来之后，可以继续推进，也可以停下来保存。",
        "保存后会进入已保存列表，后续可以继续运行，也可以复用为模板。",
    ], font_size=16, color=PALETTE["text"])
    add_picture_frame(slide, img_analytics, Inches(6.7), Inches(1.5), Inches(5.5), Inches(2.4), title="统计分析")
    add_picture_frame(slide, img_export, Inches(6.7), Inches(4.15), Inches(5.5), Inches(2.4), title="导出与报告")

    # Slide 15
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "PART 3", "平台的核心功能可以概括成四条主线", None)
    lines = [
        ("智能体生成", "支持模板、AI 批量生成与导入三种方式。"),
        ("仿真推进", "通过推进节点不断向前演化群体过程。"),
        ("因果干预", "从历史节点分支，对条件进行控制和对比。"),
        ("结果总结", "日志、统计、AI 报告与导出共同构成总结层。"),
    ]
    for idx, (title, body) in enumerate(lines):
        x = Inches(0.95 + (idx % 2) * 6.0)
        y = Inches(1.8 + (idx // 2) * 2.05)
        add_round_rect(slide, x, y, Inches(5.35), Inches(1.55), PALETTE["surface"], PALETTE["border"])
        add_textbox(slide, x + Inches(0.22), y + Inches(0.18), Inches(1.8), Inches(0.3), title, font_size=16, bold=True, color=PALETTE["primary_dark"])
        add_textbox(slide, x + Inches(0.22), y + Inches(0.58), Inches(4.7), Inches(0.55), body, font_size=12.5, color=PALETTE["muted"])
    add_textbox(slide, Inches(1.0), Inches(6.45), Inches(11.0), Inches(0.35), "其中最能体现平台差异化价值的，是实验树、分支对比和干预设计。", font_size=11.5, color=PALETTE["primary_dark"])

    # Slide 16
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "CASE A", "简单案例：囚徒困境如何快速完成一个最小实验", "这个案例适合用来说明平台的最小闭环：场景选择、角色生成、推进节点、观察合作与背叛。")
    add_round_rect(slide, Inches(0.95), Inches(1.7), Inches(11.3), Inches(4.3), PALETTE["surface"], PALETTE["border"])
    stages = [
        "选择囚徒困境场景",
        "生成两名或多名角色",
        "设置收益矩阵与初始条件",
        "推进节点，观察合作/背叛演化",
    ]
    for idx, label in enumerate(stages):
        x = Inches(1.2 + idx * 2.72)
        add_round_rect(slide, x, Inches(2.55), Inches(2.25), Inches(1.45), PALETTE["bg_soft"], PALETTE["border"])
        add_textbox(slide, x + Inches(0.14), Inches(2.85), Inches(1.95), Inches(0.5), label, font_size=13, bold=True, color=PALETTE["text"], align=PP_ALIGN.CENTER)
        if idx < len(stages) - 1:
            connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x + Inches(2.25), Inches(3.25), x + Inches(2.56), Inches(3.25))
            connector.line.color.rgb = PALETTE["primary"]
            connector.line.width = Pt(2.5)
    add_textbox(slide, Inches(1.2), Inches(5.15), Inches(10.2), Inches(0.5), "这个案例的价值不在于复杂，而在于它能快速展示：不同角色设定、不同收益结构和不同信息条件，会怎样改变合作结果。", font_size=12.5, color=PALETTE["muted"])

    # Slide 17
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_title_block(slide, "CASE B", "复杂案例：政策意义侵蚀", "这个案例更接近真实世界，适合展示传播链条、层级结构、解释偏差与政策走样。")
    add_picture_frame(slide, img_workspace, Inches(0.85), Inches(1.55), Inches(5.8), Inches(4.9), title="复杂案例工作台")
    add_bullets(slide, Inches(7.0), Inches(1.75), Inches(5.0), Inches(4.5), [
        "同一条政策信息在不同层级和角色之间传递时，可能出现再解释、弱化、偏移与选择性执行。",
        "通过分支机制，可以比较不同沟通结构、不同约束条件、不同干预强度下的最终差异。",
        "这类问题只看最终结果往往不够，必须结合中间日志和关键节点变化来理解。",
    ], font_size=15.5, color=PALETTE["text"])

    # Slide 18
    slide = prs.slides.add_slide(blank)
    set_bg(slide, PALETTE["bg"])
    add_round_rect(slide, Inches(0.45), Inches(0.45), Inches(12.35), Inches(6.6), PALETTE["surface"], PALETTE["border"])
    add_textbox(slide, Inches(0.95), Inches(1.05), Inches(4.5), Inches(0.5), "FOS", font_size=18, bold=True, color=PALETTE["primary"])
    add_textbox(slide, Inches(0.95), Inches(1.45), Inches(7.5), Inches(1.0), "总结：FOS 想解决的，不是‘AI 会不会说话’，而是\n我们能不能把复杂社会过程做成可控、可观察、可比较的实验。", font_size=24, bold=True, color=PALETTE["text"])
    add_bullets(slide, Inches(0.98), Inches(3.0), Inches(6.5), Inches(2.2), [
        "它既能支撑最小实验，也能支撑贴近现实的复杂问题模拟。",
        "它把场景、角色、规则、分支、干预、日志和报告组织成了一个完整工作流。",
        "它的目标不是替代研究者，而是让研究者更快看到机制、证据和可比较结果。",
    ], font_size=16, color=PALETTE["text"])
    add_picture_frame(slide, img_overview, Inches(8.2), Inches(1.3), Inches(3.95), Inches(2.0), title="首页")
    add_picture_frame(slide, img_export, Inches(8.2), Inches(3.65), Inches(3.95), Inches(2.0), title="输出结果")
    add_textbox(slide, Inches(0.98), Inches(6.05), Inches(4.5), Inches(0.3), "谢谢大家。", font_size=18, bold=True, color=PALETTE["primary_dark"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prs.save(OUT_PATH)
    print(OUT_PATH)


if __name__ == "__main__":
    build_presentation()